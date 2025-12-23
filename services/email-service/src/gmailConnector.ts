import { google, gmail_v1 } from 'googleapis';
import emailAuthService from './emailAuthService';

/**
 * Email message retrieved from Gmail
 */
export interface GmailMessage {
  id: string;
  threadId: string;
  rawEmail: string;
  labels: string[];
  internalDate: Date;
}

/**
 * Gmail sync options
 */
export interface GmailSyncOptions {
  maxResults?: number;
  monthsBack?: number;
  pageToken?: string;
}

/**
 * GmailConnector handles interaction with Gmail API
 */
class GmailConnector {
  /**
   * Lists messages from Gmail inbox
   * @param credentialId - Email credential ID
   * @param options - Sync options
   * @returns Array of Gmail messages and next page token
   */
  async listMessages(
    credentialId: string,
    userId: string,
    options: GmailSyncOptions = {}
  ): Promise<{ messages: GmailMessage[]; nextPageToken?: string }> {
    try {
      // Get and refresh credentials if needed
      const credentials = await emailAuthService.refreshAccessToken(credentialId);

      if (!credentials.oauthCredentials) {
        throw new Error('OAuth credentials not found');
      }

      // Initialize Gmail API
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: credentials.oauthCredentials.accessToken
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Calculate date filter
      let query = 'in:inbox';
      if (options.monthsBack) {
        const dateFrom = new Date();
        dateFrom.setMonth(dateFrom.getMonth() - options.monthsBack);
        const dateString = dateFrom.toISOString().split('T')[0].replace(/-/g, '/');
        query += ` after:${dateString}`;
      }

      // List message IDs
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: options.maxResults || 100,
        pageToken: options.pageToken
      });

      if (!listResponse.data.messages || listResponse.data.messages.length === 0) {
        return { messages: [] };
      }

      // Fetch full message details in parallel
      const messagePromises = listResponse.data.messages.map(async (msg) => {
        if (!msg.id) return null;
        return this.getMessage(gmail, msg.id);
      });

      const messages = (await Promise.all(messagePromises)).filter(
        (msg): msg is GmailMessage => msg !== null
      );

      return {
        messages,
        nextPageToken: listResponse.data.nextPageToken || undefined
      };
    } catch (error) {
      throw new Error(
        `Failed to list Gmail messages: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Gets a single message from Gmail
   * @param gmail - Gmail API instance
   * @param messageId - Message ID
   * @returns Gmail message
   */
  private async getMessage(
    gmail: gmail_v1.Gmail,
    messageId: string
  ): Promise<GmailMessage | null> {
    try {
      const message = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'raw' // Get raw RFC822 format
      });

      if (!message.data || !message.data.raw) {
        console.warn(`Message ${messageId} has no raw content`);
        return null;
      }

      // Decode base64url to get raw email
      const rawEmail = Buffer.from(message.data.raw, 'base64url').toString('utf-8');

      return {
        id: messageId,
        threadId: message.data.threadId || messageId,
        rawEmail,
        labels: message.data.labelIds || [],
        internalDate: message.data.internalDate
          ? new Date(parseInt(message.data.internalDate))
          : new Date()
      };
    } catch (error) {
      console.error(`Failed to get message ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Gets messages since a specific date
   * @param credentialId - Email credential ID
   * @param userId - User ID
   * @param since - Date to fetch messages from
   * @param maxResults - Maximum number of messages
   * @returns Array of Gmail messages
   */
  async getMessagesSince(
    credentialId: string,
    userId: string,
    since: Date,
    maxResults: number = 100
  ): Promise<GmailMessage[]> {
    try {
      const credentials = await emailAuthService.refreshAccessToken(credentialId);

      if (!credentials.oauthCredentials) {
        throw new Error('OAuth credentials not found');
      }

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: credentials.oauthCredentials.accessToken
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Format date for Gmail query
      const dateString = since.toISOString().split('T')[0].replace(/-/g, '/');
      const query = `in:inbox after:${dateString}`;

      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults
      });

      if (!listResponse.data.messages || listResponse.data.messages.length === 0) {
        return [];
      }

      // Fetch full message details
      const messagePromises = listResponse.data.messages.map(async (msg) => {
        if (!msg.id) return null;
        return this.getMessage(gmail, msg.id);
      });

      const messages = (await Promise.all(messagePromises)).filter(
        (msg): msg is GmailMessage => msg !== null
      );

      return messages;
    } catch (error) {
      throw new Error(
        `Failed to get Gmail messages since ${since}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Gets user's Gmail profile
   * @param credentialId - Email credential ID
   * @param userId - User ID
   * @returns Gmail profile
   */
  async getProfile(credentialId: string, _userId: string): Promise<{
    emailAddress: string;
    messagesTotal: number;
    threadsTotal: number;
  }> {
    try {
      const credentials = await emailAuthService.refreshAccessToken(credentialId);

      if (!credentials.oauthCredentials) {
        throw new Error('OAuth credentials not found');
      }

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: credentials.oauthCredentials.accessToken
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      const profile = await gmail.users.getProfile({ userId: 'me' });

      return {
        emailAddress: profile.data.emailAddress || '',
        messagesTotal: profile.data.messagesTotal || 0,
        threadsTotal: profile.data.threadsTotal || 0
      };
    } catch (error) {
      throw new Error(
        `Failed to get Gmail profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Checks if Gmail labels include important/starred flags
   * @param labels - Gmail label IDs
   * @returns Flags object
   */
  parseLabels(labels: string[]): { isImportant: boolean; isStarred: boolean } {
    return {
      isImportant: labels.includes('IMPORTANT'),
      isStarred: labels.includes('STARRED')
    };
  }
}

// Export singleton instance
export default new GmailConnector();
