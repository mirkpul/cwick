import { google } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import cryptoService from './cryptoService';
import { db } from './db';

const pool = db.pool;

/**
 * Email provider types
 */
export type EmailProvider = 'gmail' | 'outlook' | 'imap';

/**
 * OAuth credentials for Gmail/Outlook
 */
export interface OAuthCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

/**
 * IMAP credentials
 */
export interface ImapCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

/**
 * Stored email credentials
 */
export interface EmailCredentials {
  id: string;
  userId: string;
  provider: EmailProvider;
  emailAddress: string;
  oauthCredentials?: OAuthCredentials;
  imapCredentials?: ImapCredentials;
  autoSyncEnabled: boolean;
  lastSyncAt?: Date;
}

/**
 * EmailAuthService handles authentication for various email providers
 */
class EmailAuthService {
  /**
   * Generates Gmail OAuth URL for user authorization
   * @param userId - User ID to associate with the credentials
   * @returns Authorization URL
   */
  getGmailAuthUrl(userId: string): string {
    const oauth2Client = this.getGmailOAuth2Client();

    // Generate state parameter for CSRF protection
    const state = cryptoService.encrypt(
      JSON.stringify({
        userId,
        timestamp: Date.now(),
        provider: 'gmail'
      })
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly'
      ],
      state,
      prompt: 'consent' // Force consent to get refresh token
    });

    return authUrl;
  }

  /**
   * Handles Gmail OAuth callback and stores credentials
   * @param code - Authorization code from OAuth callback
   * @param state - State parameter for CSRF validation
   * @returns User ID and credential ID
   */
  async handleGmailCallback(
    code: string,
    state: string
  ): Promise<{ userId: string; credentialId: string }> {
    try {
      // Validate and decode state
      const stateData = JSON.parse(cryptoService.decrypt(state));
      const { userId, timestamp } = stateData;

      if (!userId) {
        throw new Error('Invalid state: missing userId');
      }

      // Check state is not too old (15 minutes)
      if (Date.now() - timestamp > 15 * 60 * 1000) {
        throw new Error('Authorization expired. Please try again.');
      }

      // Exchange code for tokens
      const oauth2Client = this.getGmailOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Failed to obtain access tokens');
      }

      // Get user's email address
      oauth2Client.setCredentials(tokens);
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: 'me' });
      const emailAddress = profile.data.emailAddress;

      if (!emailAddress) {
        throw new Error('Failed to retrieve email address');
      }

      // Calculate token expiration
      const expiresAt = tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : new Date(Date.now() + 3600 * 1000); // Default 1 hour

      // Store credentials in database
      const credentialId = await this.storeCredentials(userId, {
        provider: 'gmail',
        emailAddress,
        oauthCredentials: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt
        }
      });

      return { userId, credentialId };
    } catch (error) {
      throw new Error(
        `Gmail OAuth failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generates Outlook OAuth URL for user authorization
   * @param userId - User ID to associate with the credentials
   * @returns Authorization URL
   */
  getOutlookAuthUrl(userId: string): string {
    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const redirectUri = process.env.OUTLOOK_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new Error('Outlook OAuth not configured');
    }

    // Generate state parameter for CSRF protection
    const state = cryptoService.encrypt(
      JSON.stringify({
        userId,
        timestamp: Date.now(),
        provider: 'outlook'
      })
    );

    const scopes = ['Mail.Read', 'Mail.ReadBasic', 'offline_access'];

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scopes.join(' '))}` +
      `&state=${encodeURIComponent(state)}` +
      `&response_mode=query`;

    return authUrl;
  }

  /**
   * Handles Outlook OAuth callback and stores credentials
   * @param code - Authorization code from OAuth callback
   * @param state - State parameter for CSRF validation
   * @returns User ID and credential ID
   */
  async handleOutlookCallback(
    code: string,
    state: string
  ): Promise<{ userId: string; credentialId: string }> {
    try {
      // Validate and decode state
      const stateData = JSON.parse(cryptoService.decrypt(state));
      const { userId, timestamp } = stateData;

      // Check state is not too old (15 minutes)
      if (Date.now() - timestamp > 15 * 60 * 1000) {
        throw new Error('Authorization expired. Please try again.');
      }

      // Exchange code for tokens
      const tokenResponse = await this.exchangeOutlookCode(code);

      // Get user's email address using Microsoft Graph
      const client = Client.init({
        authProvider: (done) => {
          done(null, tokenResponse.access_token);
        }
      });

      const user = await client.api('/me').get();
      const emailAddress = user.mail || user.userPrincipalName;

      if (!emailAddress) {
        throw new Error('Failed to retrieve email address');
      }

      // Calculate token expiration
      const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

      // Store credentials in database
      const credentialId = await this.storeCredentials(userId, {
        provider: 'outlook',
        emailAddress,
        oauthCredentials: {
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresAt
        }
      });

      return { userId, credentialId };
    } catch (error) {
      throw new Error(
        `Outlook OAuth failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Stores IMAP credentials
   * @param userId - User ID
   * @param emailAddress - User's email address
   * @param imapConfig - IMAP configuration
   * @returns Credential ID
   */
  async storeImapCredentials(
    userId: string,
    emailAddress: string,
    imapConfig: ImapCredentials
  ): Promise<string> {
    return this.storeCredentials(userId, {
      provider: 'imap',
      emailAddress,
      imapCredentials: imapConfig
    });
  }

  /**
   * Retrieves email credentials for a user
   * @param userId - User ID
   * @param credentialId - Optional credential ID to get specific credential
   * @returns Email credentials
   */
  async getCredentials(
    userId: string,
    credentialId?: string
  ): Promise<EmailCredentials | null> {
    try {
      let query: string;
      let values: (string | undefined)[];

      if (credentialId) {
        query = `
          SELECT id, user_id, provider, email_address,
                 encrypted_access_token, encrypted_refresh_token, token_expires_at,
                 imap_host, imap_port, encrypted_imap_password,
                 auto_sync_enabled, last_sync_at
          FROM email_credentials
          WHERE id = $1 AND user_id = $2 AND is_active = true
        `;
        values = [credentialId, userId];
      } else {
        query = `
          SELECT id, user_id, provider, email_address,
                 encrypted_access_token, encrypted_refresh_token, token_expires_at,
                 imap_host, imap_port, encrypted_imap_password,
                 auto_sync_enabled, last_sync_at
          FROM email_credentials
          WHERE user_id = $1 AND is_active = true
          ORDER BY created_at DESC
          LIMIT 1
        `;
        values = [userId];
      }

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      return this.decryptCredentials(row);
    } catch (error) {
      throw new Error(
        `Failed to retrieve credentials: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Refreshes OAuth access token if expired
   * @param credentialId - Credential ID
   * @returns Updated credentials
   */
  async refreshAccessToken(credentialId: string): Promise<EmailCredentials> {
    const query = `
      SELECT id, user_id, provider, email_address,
             encrypted_access_token, encrypted_refresh_token, token_expires_at
      FROM email_credentials
      WHERE id = $1 AND is_active = true
    `;

    const result = await pool.query(query, [credentialId]);

    if (result.rows.length === 0) {
      throw new Error('Credentials not found');
    }

    const row = result.rows[0];
    const credentials = this.decryptCredentials(row);

    if (!credentials.oauthCredentials) {
      throw new Error('Not OAuth credentials');
    }

    // Check if token needs refresh
    const now = new Date();
    if (credentials.oauthCredentials.expiresAt > now) {
      return credentials; // Token still valid
    }

    // Refresh token based on provider
    let newTokens: { accessToken: string; expiresAt: Date };

    if (credentials.provider === 'gmail') {
      newTokens = await this.refreshGmailToken(
        credentials.oauthCredentials.refreshToken
      );
    } else if (credentials.provider === 'outlook') {
      newTokens = await this.refreshOutlookToken(
        credentials.oauthCredentials.refreshToken
      );
    } else {
      throw new Error('Invalid provider for token refresh');
    }

    // Update credentials in database
    const encryptedAccessToken = cryptoService.encrypt(newTokens.accessToken);

    await pool.query(
      `UPDATE email_credentials
       SET encrypted_access_token = $1, token_expires_at = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [encryptedAccessToken, newTokens.expiresAt, credentialId]
    );

    credentials.oauthCredentials.accessToken = newTokens.accessToken;
    credentials.oauthCredentials.expiresAt = newTokens.expiresAt;

    return credentials;
  }

  /**
   * Deletes email credentials
   * @param userId - User ID
   * @param credentialId - Credential ID
   */
  async deleteCredentials(userId: string, credentialId: string): Promise<void> {
    await pool.query(
      `UPDATE email_credentials
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2`,
      [credentialId, userId]
    );
  }

  // Private helper methods

  private getGmailOAuth2Client() {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = process.env.GMAIL_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Gmail OAuth not configured');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private async exchangeOutlookCode(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
    const redirectUri = process.env.OUTLOOK_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Outlook OAuth not configured');
    }

    const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    return data;
  }

  private async refreshGmailToken(
    refreshToken: string
  ): Promise<{ accessToken: string; expiresAt: Date }> {
    const oauth2Client = this.getGmailOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token || !credentials.expiry_date) {
      throw new Error('Failed to refresh Gmail token');
    }

    return {
      accessToken: credentials.access_token,
      expiresAt: new Date(credentials.expiry_date)
    };
  }

  private async refreshOutlookToken(
    refreshToken: string
  ): Promise<{ accessToken: string; expiresAt: Date }> {
    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Outlook OAuth not configured');
    }

    const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000)
    };
  }

  private async storeCredentials(
    userId: string,
    data: {
      provider: EmailProvider;
      emailAddress: string;
      oauthCredentials?: OAuthCredentials;
      imapCredentials?: ImapCredentials;
    }
  ): Promise<string> {
    const { provider, emailAddress, oauthCredentials, imapCredentials } = data;

    // Get subscription tier to set email limit
    const tierResult = await pool.query(
      `SELECT tier FROM subscriptions WHERE user_id = $1`,
      [userId]
    );

    let maxEmailsLimit: number | null = 1000; // Free tier default
    if (tierResult.rows.length > 0) {
      const tier = tierResult.rows[0].tier;
      if (tier === 'pro') maxEmailsLimit = 5000;
      else if (tier === 'enterprise') maxEmailsLimit = null; // Unlimited
    }

    let query: string;
    let values: (string | number | null)[];

    if (oauthCredentials) {
      const encryptedAccessToken = cryptoService.encrypt(oauthCredentials.accessToken);
      const encryptedRefreshToken = cryptoService.encrypt(oauthCredentials.refreshToken);

      query = `
        INSERT INTO email_credentials
          (user_id, provider, email_address, encrypted_access_token,
           encrypted_refresh_token, token_expires_at, max_emails_limit)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, email_address)
        DO UPDATE SET
          encrypted_access_token = EXCLUDED.encrypted_access_token,
          encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
          token_expires_at = EXCLUDED.token_expires_at,
          is_active = true,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `;
      values = [
        userId,
        provider,
        emailAddress,
        encryptedAccessToken,
        encryptedRefreshToken,
        oauthCredentials.expiresAt.toISOString(),
        maxEmailsLimit
      ];
    } else if (imapCredentials) {
      const encryptedPassword = cryptoService.encrypt(imapCredentials.password);

      query = `
        INSERT INTO email_credentials
          (user_id, provider, email_address, imap_host, imap_port,
           encrypted_imap_password, max_emails_limit)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, email_address)
        DO UPDATE SET
          imap_host = EXCLUDED.imap_host,
          imap_port = EXCLUDED.imap_port,
          encrypted_imap_password = EXCLUDED.encrypted_imap_password,
          is_active = true,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `;
      values = [
        userId,
        provider,
        emailAddress,
        imapCredentials.host,
        imapCredentials.port,
        encryptedPassword,
        maxEmailsLimit
      ];
    } else {
      throw new Error('Either OAuth or IMAP credentials required');
    }

    const result = await pool.query(query, values);
    return result.rows[0].id;
  }

  private decryptCredentials(row: {
    id: string;
    user_id: string;
    provider: EmailProvider;
    email_address: string;
    encrypted_access_token?: string;
    encrypted_refresh_token?: string;
    token_expires_at?: Date;
    imap_host?: string;
    imap_port?: number;
    encrypted_imap_password?: string;
    auto_sync_enabled: boolean;
    last_sync_at?: Date;
  }): EmailCredentials {
    const credentials: EmailCredentials = {
      id: row.id,
      userId: row.user_id,
      provider: row.provider,
      emailAddress: row.email_address,
      autoSyncEnabled: row.auto_sync_enabled,
      lastSyncAt: row.last_sync_at
    };

    if (row.encrypted_access_token && row.encrypted_refresh_token && row.token_expires_at) {
      credentials.oauthCredentials = {
        accessToken: cryptoService.decrypt(row.encrypted_access_token),
        refreshToken: cryptoService.decrypt(row.encrypted_refresh_token),
        expiresAt: new Date(row.token_expires_at)
      };
    }

    if (row.imap_host && row.imap_port && row.encrypted_imap_password) {
      credentials.imapCredentials = {
        host: row.imap_host,
        port: row.imap_port,
        user: row.email_address,
        password: cryptoService.decrypt(row.encrypted_imap_password),
        tls: true
      };
    }

    return credentials;
  }
}

// Export singleton instance
export default new EmailAuthService();
