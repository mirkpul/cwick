import emailAuthService from './emailAuthService';
import gmailConnector, { GmailMessage } from './gmailConnector';
import outlookConnector, { OutlookMessage } from './outlookConnector';
import imapConnector, { ImapMessage } from './imapConnector';
import emailParserService, { ProcessedEmail } from './emailParserService';
import db from '../config/database';

const pool = db.pool;

/**
 * Sync result statistics
 */
export interface SyncResult {
  syncId: string;
  emailsProcessed: number;
  emailsAdded: number;
  emailsSkipped: number;
  emailsFailed: number;
  errors: string[];
}

/**
 * EmailSyncService orchestrates email synchronization
 */
class EmailSyncService {
  /**
   * Performs initial sync for a credential
   * @param userId - User ID
   * @param credentialId - Credential ID
   * @returns Sync result
   */
  async performInitialSync(
    userId: string,
    credentialId: string
  ): Promise<SyncResult> {
    // Get credential details
    const credentials = await emailAuthService.getCredentials(userId, credentialId);

    if (!credentials) {
      throw new Error('Credentials not found');
    }

    // Get months to import from credential settings (default 6)
    const query = `SELECT months_to_import, max_emails_limit FROM email_credentials WHERE id = $1`;
    const result = await pool.query(query, [credentialId]);
    const monthsToImport = result.rows[0]?.months_to_import || 6;
    const maxEmailsLimit = result.rows[0]?.max_emails_limit;

    // Create sync history record
    const syncId = await this.createSyncHistory(credentialId, 'initial');

    try {
      // Update sync status to in_progress
      await this.updateSyncHistory(syncId, 'in_progress');

      // Fetch emails based on provider
      let rawMessages: (GmailMessage | OutlookMessage | ImapMessage)[] = [];

      if (credentials.provider === 'gmail' && credentials.oauthCredentials) {
        const result = await gmailConnector.listMessages(credentialId, userId, {
          maxResults: maxEmailsLimit || 1000,
          monthsBack: monthsToImport
        });
        rawMessages = result.messages;
      } else if (credentials.provider === 'outlook' && credentials.oauthCredentials) {
        const result = await outlookConnector.listMessages(credentialId, userId, {
          maxResults: maxEmailsLimit || 1000,
          monthsBack: monthsToImport
        });
        rawMessages = result.messages;
      } else if (credentials.provider === 'imap' && credentials.imapCredentials) {
        rawMessages = await imapConnector.listMessages(credentials.imapCredentials, {
          maxResults: maxEmailsLimit || 1000,
          monthsBack: monthsToImport
        });
      }

      // Process emails
      const syncResult = await this.processEmails(
        userId,
        credentialId,
        rawMessages,
        credentials.provider
      );

      syncResult.syncId = syncId;

      // Update sync history
      await this.updateSyncHistory(syncId, 'completed', syncResult);

      // Update credential last_sync_at
      await pool.query(
        `UPDATE email_credentials
         SET last_sync_at = CURRENT_TIMESTAMP, last_sync_status = 'success'
         WHERE id = $1`,
        [credentialId]
      );

      return syncResult;
    } catch (error) {
      // Update sync history with error
      await this.updateSyncHistory(syncId, 'failed', undefined, error);

      // Update credential status
      await pool.query(
        `UPDATE email_credentials
         SET last_sync_status = 'failed',
             last_sync_error = $2
         WHERE id = $1`,
        [credentialId, error instanceof Error ? error.message : 'Unknown error']
      );

      throw error;
    }
  }

  /**
   * Performs incremental sync (new emails since last sync)
   * @param userId - User ID
   * @param credentialId - Credential ID
   * @returns Sync result
   */
  async performIncrementalSync(
    userId: string,
    credentialId: string
  ): Promise<SyncResult> {
    const credentials = await emailAuthService.getCredentials(userId, credentialId);

    if (!credentials) {
      throw new Error('Credentials not found');
    }

    if (!credentials.lastSyncAt) {
      // No previous sync, perform initial sync instead
      return this.performInitialSync(userId, credentialId);
    }

    const syncId = await this.createSyncHistory(credentialId, 'incremental');

    try {
      await this.updateSyncHistory(syncId, 'in_progress');

      // Fetch new emails since last sync
      let rawMessages: (GmailMessage | OutlookMessage | ImapMessage)[] = [];

      if (credentials.provider === 'gmail' && credentials.oauthCredentials) {
        rawMessages = await gmailConnector.getMessagesSince(
          credentialId,
          userId,
          credentials.lastSyncAt
        );
      } else if (credentials.provider === 'outlook' && credentials.oauthCredentials) {
        rawMessages = await outlookConnector.getMessagesSince(
          credentialId,
          userId,
          credentials.lastSyncAt
        );
      } else if (credentials.provider === 'imap' && credentials.imapCredentials) {
        rawMessages = await imapConnector.getMessagesSince(
          credentials.imapCredentials,
          credentials.lastSyncAt
        );
      }

      const syncResult = await this.processEmails(
        userId,
        credentialId,
        rawMessages,
        credentials.provider
      );

      syncResult.syncId = syncId;

      await this.updateSyncHistory(syncId, 'completed', syncResult);

      await pool.query(
        `UPDATE email_credentials
         SET last_sync_at = CURRENT_TIMESTAMP, last_sync_status = 'success'
         WHERE id = $1`,
        [credentialId]
      );

      return syncResult;
    } catch (error) {
      await this.updateSyncHistory(syncId, 'failed', undefined, error);

      await pool.query(
        `UPDATE email_credentials
         SET last_sync_status = 'failed',
             last_sync_error = $2
         WHERE id = $1`,
        [credentialId, error instanceof Error ? error.message : 'Unknown error']
      );

      throw error;
    }
  }

  /**
   * Processes raw email messages
   * @param userId - User ID
   * @param credentialId - Credential ID
   * @param rawMessages - Raw email messages
   * @param provider - Email provider
   * @returns Sync result statistics
   */
  private async processEmails(
    userId: string,
    credentialId: string,
    rawMessages: (GmailMessage | OutlookMessage | ImapMessage)[],
    provider: string
  ): Promise<SyncResult> {
    const result: SyncResult = {
      syncId: '',
      emailsProcessed: 0,
      emailsAdded: 0,
      emailsSkipped: 0,
      emailsFailed: 0,
      errors: []
    };

    for (const rawMsg of rawMessages) {
      result.emailsProcessed++;

      try {
        // Parse raw email
        const parsed = await emailParserService.parseRawEmail(rawMsg.rawEmail);

        // Process with sensitive data detection
        const processed = emailParserService.processEmail(parsed);

        // Extract metadata based on provider
        let labels: string[] = [];
        let isImportant = false;
        let isStarred = false;
        let threadId = parsed.messageId || rawMsg.id;

        if (provider === 'gmail' && 'labels' in rawMsg) {
          labels = rawMsg.labels || [];
          const flags = gmailConnector.parseLabels(labels);
          isImportant = flags.isImportant;
          isStarred = flags.isStarred;
          threadId = rawMsg.threadId || parsed.messageId || rawMsg.id;
        } else if (provider === 'outlook' && 'categories' in rawMsg) {
          const metadata = outlookConnector.parseMetadata(
            rawMsg.categories || [],
            rawMsg.isImportant || false,
            rawMsg.isFlagged || false
          );
          labels = metadata.labels;
          isImportant = metadata.isImportant;
          isStarred = metadata.isStarred;
          threadId = rawMsg.conversationId || parsed.messageId || rawMsg.id;
        } else if (provider === 'imap' && 'flags' in rawMsg) {
          const flags = imapConnector.parseFlags(rawMsg.flags || []);
          isImportant = flags.isImportant;
          isStarred = flags.isStarred;
        }

        // Store in database
        const saved = await this.saveEmailToDatabase(
          userId,
          credentialId,
          processed,
          {
            emailId: rawMsg.id,
            threadId,
            labels,
            isImportant,
            isStarred
          }
        );

        if (saved) {
          result.emailsAdded++;
        } else {
          result.emailsSkipped++;
        }
      } catch (error) {
        result.emailsFailed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Failed to process email: ${errorMsg}`);
        console.error('Email processing error:', error);
      }
    }

    return result;
  }

  /**
   * Saves processed email to database
   * @param userId - User ID
   * @param credentialId - Credential ID
   * @param email - Processed email
   * @param metadata - Additional metadata
   * @returns True if saved, false if skipped (duplicate)
   */
  private async saveEmailToDatabase(
    userId: string,
    credentialId: string,
    email: ProcessedEmail,
    metadata: {
      emailId: string;
      threadId: string;
      labels: string[];
      isImportant: boolean;
      isStarred: boolean;
    }
  ): Promise<boolean> {
    try {
      // Create combined text for embedding
      // Note: knowledgeText generation is deferred to embedding phase
      // await emailParserService.createKnowledgeBaseText(email);

      // For now, we'll store without embeddings
      // Embeddings will be generated in the RAG integration step

      const query = `
        INSERT INTO email_knowledge (
          user_id, credential_id, email_id, thread_id,
          subject, sender_email, sender_name, recipients, cc_recipients,
          sent_at, body_text, body_html,
          is_reply, in_reply_to,
          has_attachments, attachment_count, attachments_metadata,
          labels, is_important, is_starred,
          has_sensitive_data, redacted_fields
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
        )
        ON CONFLICT (credential_id, email_id) DO NOTHING
        RETURNING id
      `;

      const values = [
        userId,
        credentialId,
        metadata.emailId,
        metadata.threadId,
        email.subject,
        email.senderEmail,
        email.senderName,
        JSON.stringify(email.recipients),
        JSON.stringify(email.ccRecipients),
        email.sentAt,
        email.sanitizedBodyText,
        email.bodyHtml,
        email.isReply,
        email.inReplyTo,
        email.hasAttachments,
        email.attachments.length,
        JSON.stringify(
          email.attachments.map(att => ({
            filename: att.filename,
            contentType: att.contentType,
            size: att.size
          }))
        ),
        JSON.stringify(metadata.labels),
        metadata.isImportant,
        metadata.isStarred,
        email.hasSensitiveData,
        JSON.stringify(email.redactedFields)
      ];

      const result = await pool.query(query, values);

      // If no rows returned, it was a duplicate (skipped)
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Failed to save email to database:', error);
      throw error;
    }
  }

  /**
   * Creates a sync history record
   * @param credentialId - Credential ID
   * @param syncType - Type of sync
   * @returns Sync history ID
   */
  private async createSyncHistory(
    credentialId: string,
    syncType: 'initial' | 'incremental' | 'manual'
  ): Promise<string> {
    const query = `
      INSERT INTO email_sync_history (credential_id, sync_type, started_at, status)
      VALUES ($1, $2, CURRENT_TIMESTAMP, 'in_progress')
      RETURNING id
    `;

    const result = await pool.query(query, [credentialId, syncType]);
    return result.rows[0].id;
  }

  /**
   * Updates sync history record
   * @param syncId - Sync history ID
   * @param status - New status
   * @param result - Sync result (optional)
   * @param error - Error (optional)
   */
  private async updateSyncHistory(
    syncId: string,
    status: 'in_progress' | 'completed' | 'failed' | 'partial',
    result?: SyncResult,
    error?: Error | unknown
  ): Promise<void> {
    const query = `
      UPDATE email_sync_history
      SET status = $2::VARCHAR,
          completed_at = CASE WHEN $2::VARCHAR IN ('completed', 'failed', 'partial')
                          THEN CURRENT_TIMESTAMP ELSE completed_at END,
          emails_processed = $3,
          emails_added = $4,
          emails_skipped = $5,
          emails_failed = $6,
          error_message = $7,
          error_details = $8
      WHERE id = $1
    `;

    const values = [
      syncId,
      status,
      result?.emailsProcessed || 0,
      result?.emailsAdded || 0,
      result?.emailsSkipped || 0,
      result?.emailsFailed || 0,
      error ? (error instanceof Error ? error.message : String(error)) : null,
      error && result?.errors ? JSON.stringify(result.errors) : null
    ];

    await pool.query(query, values);
  }

  /**
   * Deletes a specific email from knowledge base
   * @param userId - User ID
   * @param emailId - Email knowledge ID
   */
  async deleteEmail(userId: string, emailId: string): Promise<void> {
    await pool.query(
      `DELETE FROM email_knowledge WHERE id = $1 AND user_id = $2`,
      [emailId, userId]
    );
  }

  /**
   * Gets sync statistics for a credential
   * @param credentialId - Credential ID
   * @returns Sync stats
   */
  async getSyncStats(credentialId: string): Promise<{
    totalEmails: number;
    lastSyncAt?: Date;
    lastSyncStatus?: string;
    syncHistory: Array<{
      id: string;
      type: string;
      status: string;
      started_at: Date;
      completed_at?: Date;
      emails_processed: number;
      emails_added: number;
      emails_skipped: number;
      emails_failed: number;
    }>;
  }> {
    // Get total emails
    const emailCountQuery = `
      SELECT COUNT(*) as total FROM email_knowledge WHERE credential_id = $1
    `;
    const emailCount = await pool.query(emailCountQuery, [credentialId]);

    // Get credential status
    const credQuery = `
      SELECT last_sync_at, last_sync_status FROM email_credentials WHERE id = $1
    `;
    const credResult = await pool.query(credQuery, [credentialId]);

    // Get recent sync history
    const historyQuery = `
      SELECT * FROM email_sync_history
      WHERE credential_id = $1
      ORDER BY started_at DESC
      LIMIT 10
    `;
    const historyResult = await pool.query(historyQuery, [credentialId]);

    return {
      totalEmails: parseInt(emailCount.rows[0].total),
      lastSyncAt: credResult.rows[0]?.last_sync_at,
      lastSyncStatus: credResult.rows[0]?.last_sync_status,
      syncHistory: historyResult.rows
    };
  }
}

// Export singleton instance
export default new EmailSyncService();
