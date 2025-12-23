import { Client } from '@microsoft/microsoft-graph-client';
import emailAuthService from './emailAuthService';

/**
 * Email message retrieved from Outlook/Microsoft 365
 */
export interface OutlookMessage {
  id: string;
  conversationId: string;
  rawEmail: string;
  categories: string[];
  receivedDateTime: Date;
  isImportant: boolean;
  isFlagged: boolean;
}

/**
 * Outlook sync options
 */
export interface OutlookSyncOptions {
  maxResults?: number;
  monthsBack?: number;
  skipToken?: string;
}

/**
 * OutlookConnector handles interaction with Microsoft Graph API
 */
class OutlookConnector {
  /**
   * Lists messages from Outlook inbox
   * @param credentialId - Email credential ID
   * @param userId - User ID
   * @param options - Sync options
   * @returns Array of Outlook messages and next skip token
   */
  async listMessages(
    credentialId: string,
    userId: string,
    options: OutlookSyncOptions = {}
  ): Promise<{ messages: OutlookMessage[]; nextSkipToken?: string }> {
    try {
      // Get and refresh credentials if needed
      const credentials = await emailAuthService.refreshAccessToken(credentialId);

      if (!credentials.oauthCredentials) {
        throw new Error('OAuth credentials not found');
      }

      // Initialize Microsoft Graph client
      const client = this.getGraphClient(credentials.oauthCredentials.accessToken);

      // Build query parameters
      const queryParams: string[] = [
        `$select=id,conversationId,receivedDateTime,importance,flag,categories`,
        `$top=${options.maxResults || 100}`,
        `$orderby=receivedDateTime desc`
      ];

      // Filter by date if specified
      if (options.monthsBack) {
        const dateFrom = new Date();
        dateFrom.setMonth(dateFrom.getMonth() - options.monthsBack);
        const filterDate = dateFrom.toISOString();
        queryParams.push(`$filter=receivedDateTime ge ${filterDate}`);
      }

      if (options.skipToken) {
        queryParams.push(`$skiptoken=${options.skipToken}`);
      }

      const query = queryParams.join('&');

      // Get message list
      const response = await client
        .api(`/me/mailFolders/inbox/messages?${query}`)
        .get();

      if (!response.value || response.value.length === 0) {
        return { messages: [] };
      }

      // Fetch full MIME content for each message in parallel
      const messagePromises = response.value.map((msg: {
        id: string;
        conversationId?: string;
        categories?: string[];
        receivedDateTime?: string;
        importance?: string;
        flag?: { flagStatus?: string };
      }) =>
        this.getMessage(client, msg.id, msg)
      );

      const messages = (await Promise.all(messagePromises)).filter(
        (msg): msg is OutlookMessage => msg !== null
      );

      return {
        messages,
        nextSkipToken: response['@odata.nextLink']
          ? this.extractSkipToken(response['@odata.nextLink'])
          : undefined
      };
    } catch (error) {
      throw new Error(
        `Failed to list Outlook messages: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Gets a single message from Outlook
   * @param client - Graph client instance
   * @param messageId - Message ID
   * @param metadata - Message metadata (optional, to avoid extra API call)
   * @returns Outlook message
   */
  private async getMessage(
    client: Client,
    messageId: string,
    metadata?: {
      conversationId?: string;
      categories?: string[];
      receivedDateTime?: string;
      importance?: string;
      flag?: { flagStatus?: string };
    }
  ): Promise<OutlookMessage | null> {
    try {
      // Get MIME content
      const mimeContent = await client
        .api(`/me/messages/${messageId}/$value`)
        .get();

      // Convert stream/buffer to string
      const rawEmail = typeof mimeContent === 'string'
        ? mimeContent
        : mimeContent.toString('utf-8');

      return {
        id: messageId,
        conversationId: metadata?.conversationId || messageId,
        rawEmail,
        categories: metadata?.categories || [],
        receivedDateTime: metadata?.receivedDateTime
          ? new Date(metadata.receivedDateTime)
          : new Date(),
        isImportant: metadata?.importance === 'high',
        isFlagged: metadata?.flag?.flagStatus === 'flagged'
      };
    } catch (error) {
      console.error(`Failed to get Outlook message ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Gets messages since a specific date
   * @param credentialId - Email credential ID
   * @param userId - User ID
   * @param since - Date to fetch messages from
   * @param maxResults - Maximum number of messages
   * @returns Array of Outlook messages
   */
  async getMessagesSince(
    credentialId: string,
    userId: string,
    since: Date,
    maxResults: number = 100
  ): Promise<OutlookMessage[]> {
    try {
      const credentials = await emailAuthService.refreshAccessToken(credentialId);

      if (!credentials.oauthCredentials) {
        throw new Error('OAuth credentials not found');
      }

      const client = this.getGraphClient(credentials.oauthCredentials.accessToken);

      const filterDate = since.toISOString();
      const query = [
        `$select=id,conversationId,receivedDateTime,importance,flag,categories`,
        `$filter=receivedDateTime ge ${filterDate}`,
        `$top=${maxResults}`,
        `$orderby=receivedDateTime desc`
      ].join('&');

      const response = await client
        .api(`/me/mailFolders/inbox/messages?${query}`)
        .get();

      if (!response.value || response.value.length === 0) {
        return [];
      }

      // Fetch full MIME content for each message
      const messagePromises = response.value.map((msg: {
        id: string;
        conversationId?: string;
        categories?: string[];
        receivedDateTime?: string;
        importance?: string;
        flag?: { flagStatus?: string };
      }) =>
        this.getMessage(client, msg.id, msg)
      );

      const messages = (await Promise.all(messagePromises)).filter(
        (msg): msg is OutlookMessage => msg !== null
      );

      return messages;
    } catch (error) {
      throw new Error(
        `Failed to get Outlook messages since ${since}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Gets user's Outlook profile
   * @param credentialId - Email credential ID
   * @param userId - User ID
   * @returns Outlook profile
   */
  async getProfile(credentialId: string, _userId: string): Promise<{
    emailAddress: string;
    displayName: string;
  }> {
    try {
      const credentials = await emailAuthService.refreshAccessToken(credentialId);

      if (!credentials.oauthCredentials) {
        throw new Error('OAuth credentials not found');
      }

      const client = this.getGraphClient(credentials.oauthCredentials.accessToken);

      const user = await client.api('/me').get();

      return {
        emailAddress: user.mail || user.userPrincipalName || '',
        displayName: user.displayName || ''
      };
    } catch (error) {
      throw new Error(
        `Failed to get Outlook profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Creates a Microsoft Graph client
   * @param accessToken - OAuth access token
   * @returns Graph client instance
   */
  private getGraphClient(accessToken: string): Client {
    return Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });
  }

  /**
   * Extracts skip token from nextLink URL
   * @param nextLink - OData nextLink URL
   * @returns Skip token
   */
  private extractSkipToken(nextLink: string): string | undefined {
    try {
      const url = new URL(nextLink);
      return url.searchParams.get('$skiptoken') || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Parses Outlook categories and flags
   * @param categories - Category array
   * @param isImportant - Important flag
   * @param isFlagged - Flagged status
   * @returns Parsed flags
   */
  parseMetadata(
    categories: string[],
    isImportant: boolean,
    isFlagged: boolean
  ): { isImportant: boolean; isStarred: boolean; labels: string[] } {
    return {
      isImportant,
      isStarred: isFlagged,
      labels: categories
    };
  }
}

// Export singleton instance
export default new OutlookConnector();
