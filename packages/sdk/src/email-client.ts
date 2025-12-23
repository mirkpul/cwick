import { BaseClient, BaseClientConfig } from './base-client';

export interface EmailClientConfig extends Omit<BaseClientConfig, 'baseURL'> {
  baseURL?: string;
}

export interface EmailAuthUrlResponse {
  authUrl: string;
}

export interface EmailCallbackResponse {
  userId: string;
  credentialId: string;
}

export interface EmailSyncStatusResponse {
  connected: boolean;
  provider?: string;
  emailAddress?: string;
  autoSyncEnabled?: boolean;
  lastSyncAt?: string;
  syncStats?: unknown;
  embeddingStats?: unknown;
  message?: string;
}

export interface EmailListResponse {
  emails: Record<string, unknown>[];
  pagination: {
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  };
}

export interface EmailSearchResult {
  id: string;
  subject: string;
  content: string;
  similarity: number;
  sentAt: string;
}

export class EmailClient extends BaseClient {
  constructor(config: EmailClientConfig) {
    super({
      ...config,
      baseURL: config.baseURL || process.env.EMAIL_SERVICE_URL || 'http://localhost:3017',
    });
  }

  private userHeaders(userId: string) {
    return { 'x-user-id': userId };
  }

  async getGmailAuthUrl(userId: string): Promise<EmailAuthUrlResponse> {
    return this.request<EmailAuthUrlResponse>({
      method: 'GET',
      url: '/email/auth/gmail',
      headers: this.userHeaders(userId),
    });
  }

  async handleGmailCallback(payload: { code: string; state: string }): Promise<EmailCallbackResponse> {
    return this.request<EmailCallbackResponse>({
      method: 'POST',
      url: '/email/auth/gmail/callback',
      data: payload,
    });
  }

  async getOutlookAuthUrl(userId: string): Promise<EmailAuthUrlResponse> {
    return this.request<EmailAuthUrlResponse>({
      method: 'GET',
      url: '/email/auth/outlook',
      headers: this.userHeaders(userId),
    });
  }

  async handleOutlookCallback(payload: { code: string; state: string }): Promise<EmailCallbackResponse> {
    return this.request<EmailCallbackResponse>({
      method: 'POST',
      url: '/email/auth/outlook/callback',
      data: payload,
    });
  }

  async storeImapCredentials(
    userId: string,
    payload: { emailAddress: string; host: string; port: number | string; password: string }
  ): Promise<{ credentialId: string }> {
    return this.request<{ credentialId: string }>({
      method: 'POST',
      url: '/email/auth/imap',
      headers: this.userHeaders(userId),
      data: payload,
    });
  }

  async triggerSync(
    userId: string,
    payload: { credentialId?: string; type?: string }
  ): Promise<{ syncType: string }> {
    return this.request<{ syncType: string }>({
      method: 'POST',
      url: '/email/sync',
      headers: this.userHeaders(userId),
      data: payload,
    });
  }

  async getSyncStatus(userId: string): Promise<EmailSyncStatusResponse> {
    return this.request<EmailSyncStatusResponse>({
      method: 'GET',
      url: '/email/sync/status',
      headers: this.userHeaders(userId),
    });
  }

  async toggleAutoSync(userId: string, enabled: boolean): Promise<{ autoSyncEnabled: boolean }> {
    return this.request<{ autoSyncEnabled: boolean }>({
      method: 'PUT',
      url: '/email/auto-sync',
      headers: this.userHeaders(userId),
      data: { enabled },
    });
  }

  async listEmails(
    userId: string,
    params: { limit?: number; offset?: number; search?: string } = {}
  ): Promise<EmailListResponse> {
    return this.request<EmailListResponse>({
      method: 'GET',
      url: '/email/list',
      headers: this.userHeaders(userId),
      params,
    });
  }

  async deleteEmail(userId: string, emailId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>({
      method: 'DELETE',
      url: `/email/${emailId}`,
      headers: this.userHeaders(userId),
    });
  }

  async disconnectEmail(userId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>({
      method: 'DELETE',
      url: '/email/disconnect',
      headers: this.userHeaders(userId),
    });
  }

  async semanticSearch(
    userId: string,
    payload: { query: string; limit?: number; threshold?: number }
  ): Promise<{ results: EmailSearchResult[] }> {
    return this.request<{ results: EmailSearchResult[] }>({
      method: 'POST',
      url: '/email/search',
      headers: this.userHeaders(userId),
      data: payload,
    });
  }
}
