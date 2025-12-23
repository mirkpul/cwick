import { Response } from 'express';
import emailAuthService from '../services/emailAuthService';
import emailSyncService from '../services/emailSyncService';
import emailEmbeddingService from '../services/emailEmbeddingService';
import imapConnector from '../services/imapConnector';
import emailIntegrationService from '../services/emailIntegrationService';
import db from '../config/database';
import logger from '../config/logger';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Email API Controller
 */
class EmailController {
  /**
   * Initiates Gmail OAuth flow
   * GET /api/email/auth/gmail
   */
  async getGmailAuthUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        logger.error('Get Gmail auth URL failed: User not authenticated', { user: req.user });
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const userId = req.user.userId;
      if (emailIntegrationService.isEnabled()) {
        const { authUrl } = await emailIntegrationService.getGmailAuthUrl(userId);
        res.json({ authUrl });
        return;
      }

      const authUrl = emailAuthService.getGmailAuthUrl(userId);

      res.json({ authUrl });
    } catch (error) {
      logger.error('Get Gmail auth URL failed:', error);
      res.status(500).json({
        error: 'Failed to generate Gmail authorization URL',
        details: (error as Error).message
      });
    }
  }

  /**
   * Handles Gmail OAuth callback
   * GET /api/email/auth/gmail/callback
   */
  async handleGmailCallback(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        res.redirect(`${process.env.REACT_APP_URL}/auth/email/callback?error=missing_parameters`);
        return;
      }

      if (emailIntegrationService.isEnabled()) {
        await emailIntegrationService.handleGmailCallback(code as string, state as string);
      } else {
        await emailAuthService.handleGmailCallback(code as string, state as string);
      }

      // Redirect to frontend callback page with success
      res.redirect(`${process.env.REACT_APP_URL}/auth/email/callback?code=success&provider=gmail`);
    } catch (error) {
      logger.error('Gmail OAuth callback failed:', error);
      res.redirect(`${process.env.REACT_APP_URL}/auth/email/callback?error=${encodeURIComponent((error as Error).message)}`);
    }
  }

  /**
   * Initiates Outlook OAuth flow
   * GET /api/email/auth/outlook
   */
  async getOutlookAuthUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.userId) {
        logger.error('Get Outlook auth URL failed: User not authenticated', { user: req.user });
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const userId = req.user.userId;
      if (emailIntegrationService.isEnabled()) {
        const { authUrl } = await emailIntegrationService.getOutlookAuthUrl(userId);
        res.json({ authUrl });
        return;
      }

      const authUrl = emailAuthService.getOutlookAuthUrl(userId);

      res.json({ authUrl });
    } catch (error) {
      logger.error('Get Outlook auth URL failed:', error);
      res.status(500).json({
        error: 'Failed to generate Outlook authorization URL',
        details: (error as Error).message
      });
    }
  }

  /**
   * Handles Outlook OAuth callback
   * GET /api/email/auth/outlook/callback
   */
  async handleOutlookCallback(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        res.redirect(`${process.env.REACT_APP_URL}/auth/email/callback?error=missing_parameters`);
        return;
      }

      if (emailIntegrationService.isEnabled()) {
        await emailIntegrationService.handleOutlookCallback(code as string, state as string);
      } else {
        await emailAuthService.handleOutlookCallback(code as string, state as string);
      }

      res.redirect(`${process.env.REACT_APP_URL}/auth/email/callback?code=success&provider=outlook`);
    } catch (error) {
      logger.error('Outlook OAuth callback failed:', error);
      res.redirect(`${process.env.REACT_APP_URL}/auth/email/callback?error=${encodeURIComponent((error as Error).message)}`);
    }
  }

  /**
   * Stores IMAP credentials
   * POST /api/email/auth/imap
   */
  async storeImapCredentials(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { emailAddress, host, port, password } = req.body;

      if (!emailAddress || !host || !port || !password) {
        res.status(400).json({
          error: 'Missing required fields: emailAddress, host, port, password'
        });
        return;
      }

      const imapConfig = {
        host,
        port: parseInt(port),
        user: emailAddress,
        password,
        tls: true
      };

      if (emailIntegrationService.isEnabled()) {
        const { credentialId } = await emailIntegrationService.storeImapCredentials(userId, {
          emailAddress,
          host,
          port: imapConfig.port,
          password,
        });
        res.json({
          success: true,
          credentialId,
          message: 'IMAP credentials stored successfully'
        });
        return;
      }

      // Test connection first
      await imapConnector.testConnection(imapConfig);

      // Store credentials
      const credentialId = await emailAuthService.storeImapCredentials(
        userId,
        emailAddress,
        imapConfig
      );

      res.json({
        success: true,
        credentialId,
        message: 'IMAP credentials stored successfully'
      });
    } catch (error) {
      logger.error('Store IMAP credentials failed:', error);
      res.status(500).json({
        error: 'Failed to store IMAP credentials',
        details: (error as Error).message
      });
    }
  }

  /**
   * Triggers manual email sync
   * POST /api/email/sync
   */
  async triggerSync(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { credentialId, type = 'incremental' } = req.body;

      if (emailIntegrationService.isEnabled()) {
        const result = await emailIntegrationService.triggerSync(userId, { credentialId, type });
        res.json({
          success: true,
          message: 'Email sync started',
          syncType: result.syncType
        });
        return;
      }

      // Get credential (or use the first one if not specified)
      let cred = credentialId;
      if (!cred) {
        const credentials = await emailAuthService.getCredentials(userId);
        if (!credentials) {
          res.status(404).json({ error: 'No email account connected' });
          return;
        }
        cred = credentials.id;
      }

      // Start sync (async operation)
      const syncPromise = type === 'initial'
        ? emailSyncService.performInitialSync(userId, cred)
        : emailSyncService.performIncrementalSync(userId, cred);

      // Return immediately, sync continues in background
      res.json({
        success: true,
        message: 'Email sync started',
        syncType: type
      });

      // Continue sync in background
      syncPromise
        .then(async (result) => {
          logger.info(`Email sync completed for user ${userId}:`, result);

          // Generate embeddings for new emails
          await emailEmbeddingService.generateEmbeddingsForUser(userId, 20);
        })
        .catch((error) => {
          logger.error(`Email sync failed for user ${userId}:`, error);
        });
    } catch (error) {
      logger.error('Trigger email sync failed:', error);
      res.status(500).json({
        error: 'Failed to trigger email sync',
        details: (error as Error).message
      });
    }
  }

  /**
   * Gets email sync status and statistics
   * GET /api/email/sync/status
   */
  async getSyncStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      if (emailIntegrationService.isEnabled()) {
        const result = await emailIntegrationService.getSyncStatus(userId);
        res.json(result);
        return;
      }

      const credentials = await emailAuthService.getCredentials(userId);

      if (!credentials) {
        res.json({
          connected: false,
          message: 'No email account connected'
        });
        return;
      }

      const syncStats = await emailSyncService.getSyncStats(credentials.id);
      const embeddingStats = await emailEmbeddingService.getStats(userId);

      res.json({
        connected: true,
        provider: credentials.provider,
        emailAddress: credentials.emailAddress,
        autoSyncEnabled: credentials.autoSyncEnabled,
        lastSyncAt: credentials.lastSyncAt,
        syncStats,
        embeddingStats
      });
    } catch (error) {
      logger.error('Get sync status failed:', error);
      res.status(500).json({
        error: 'Failed to get sync status',
        details: (error as Error).message
      });
    }
  }

  /**
   * Enables or disables automatic sync
   * PUT /api/email/auto-sync
   */
  async toggleAutoSync(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { enabled } = req.body;

      if (emailIntegrationService.isEnabled()) {
        const result = await emailIntegrationService.toggleAutoSync(userId, enabled);
        res.json({
          success: true,
          autoSyncEnabled: result.autoSyncEnabled
        });
        return;
      }

      await db.query(
        `UPDATE email_credentials
         SET auto_sync_enabled = $1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2`,
        [enabled, userId]
      );

      res.json({
        success: true,
        autoSyncEnabled: enabled
      });
    } catch (error) {
      logger.error('Toggle auto-sync failed:', error);
      res.status(500).json({
        error: 'Failed to toggle auto-sync',
        details: (error as Error).message
      });
    }
  }

  /**
   * Lists imported emails
   * GET /api/email/list
   */
  async listEmails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { limit = '50', offset = '0', search } = req.query;

      if (emailIntegrationService.isEnabled()) {
        const result = await emailIntegrationService.listEmails(userId, {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          search: search as string | undefined
        });
        res.json(result);
        return;
      }

      // Get total count
      let countQuery = `SELECT COUNT(*) FROM email_knowledge WHERE user_id = $1`;
      const countParams: (string | number)[] = [userId];

      if (search) {
        countQuery += ` AND (subject ILIKE $2 OR body_text ILIKE $2)`;
        countParams.push(`%${search}%`);
      }

      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      // Get emails with pagination
      let query = `
        SELECT id, subject, sender_email AS "senderEmail", sender_name AS "senderName",
               sent_at AS "receivedAt", sent_at,
               is_important AS "isImportant", is_starred AS "isStarred",
               has_attachments AS "hasAttachments", labels,
               body_text AS "textContent", body_html AS "htmlContent",
               recipients,
               false AS "isRead"
        FROM email_knowledge
        WHERE user_id = $1
      `;
      const params: (string | number)[] = [userId];

      if (search) {
        query += ` AND (subject ILIKE $${params.length + 1} OR body_text ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
      }

      query += ` ORDER BY sent_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit as string), parseInt(offset as string));

      const result = await db.query(query, params);

      // Format emails for frontend
      interface EmailRow {
        senderName?: string;
        senderEmail?: string;
        recipients?: Array<{ email: string }>;
        textContent?: string;
        [key: string]: unknown;
      }

      const emails = result.rows.map((email: EmailRow) => ({
        ...email,
        sender: email.senderName || email.senderEmail,
        // Format recipients - get first recipient email if exists
        recipient: email.recipients && email.recipients.length > 0
          ? email.recipients[0].email
          : null,
        // Create snippet from text content if not exists
        snippet: email.textContent ? email.textContent.substring(0, 200) : null
      }));

      res.json({
        emails,
        pagination: {
          total,
          totalPages: Math.ceil(total / parseInt(limit as string)),
          page: Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
          limit: parseInt(limit as string)
        }
      });
    } catch (error) {
      logger.error('List emails failed:', error);
      res.status(500).json({
        error: 'Failed to list emails',
        details: (error as Error).message
      });
    }
  }

  /**
   * Deletes a specific email from knowledge base
   * DELETE /api/email/:id
   */
  async deleteEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      if (emailIntegrationService.isEnabled()) {
        await emailIntegrationService.deleteEmail(userId, id);
        res.json({
          success: true,
          message: 'Email deleted from knowledge base'
        });
        return;
      }

      await emailSyncService.deleteEmail(userId, id);

      res.json({
        success: true,
        message: 'Email deleted from knowledge base'
      });
    } catch (error) {
      logger.error('Delete email failed:', error);
      res.status(500).json({
        error: 'Failed to delete email',
        details: (error as Error).message
      });
    }
  }

  /**
   * Disconnects email account
   * DELETE /api/email/disconnect
   */
  async disconnectEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      if (emailIntegrationService.isEnabled()) {
        await emailIntegrationService.disconnectEmail(userId);
        res.json({
          success: true,
          message: 'Email account disconnected successfully'
        });
        return;
      }

      const credentials = await emailAuthService.getCredentials(userId);

      if (!credentials) {
        res.status(404).json({ error: 'No email account connected' });
        return;
      }

      await emailAuthService.deleteCredentials(userId, credentials.id);

      res.json({
        success: true,
        message: 'Email account disconnected successfully'
      });
    } catch (error) {
      logger.error('Disconnect email failed:', error);
      res.status(500).json({
        error: 'Failed to disconnect email account',
        details: (error as Error).message
      });
    }
  }

  /**
   * Searches emails using semantic search
   * POST /api/email/search
   */
  async semanticSearch(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { query, limit = 5, threshold = 0.7 } = req.body;

      if (!query) {
        res.status(400).json({ error: 'Query is required' });
        return;
      }

      if (emailIntegrationService.isEnabled()) {
        const result = await emailIntegrationService.semanticSearch(userId, {
          query,
          limit: parseInt(String(limit)),
          threshold: parseFloat(String(threshold))
        });
        res.json(result);
        return;
      }

      const results = await emailEmbeddingService.semanticSearch(
        userId,
        query,
        {
          limit: parseInt(String(limit)),
          threshold: parseFloat(String(threshold))
        }
      );

      res.json({ results });
    } catch (error) {
      logger.error('Email semantic search failed:', error);
      res.status(500).json({
        error: 'Failed to search emails',
        details: (error as Error).message
      });
    }
  }
}

export default new EmailController();
