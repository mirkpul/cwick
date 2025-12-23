import { BaseClient, BaseClientConfig } from './base-client';

export interface ChatClientConfig extends Omit<BaseClientConfig, 'baseURL'> {
  baseURL?: string;
}

export class ChatClient extends BaseClient {
  constructor(config: ChatClientConfig) {
    super({
      ...config,
      baseURL: config.baseURL || process.env.REALTIME_SERVICE_URL || 'http://localhost:3018',
    });
  }

  private userHeaders(userId: string) {
    return { 'x-user-id': userId };
  }

  async startConversation(twinId: string, payload: Record<string, unknown>) {
    return this.request<Record<string, unknown>>({
      method: 'POST',
      url: `/chat/conversations/${twinId}/start`,
      data: payload,
    });
  }

  async sendMessage(conversationId: string, payload: { content: string }) {
    return this.request<Record<string, unknown>>({
      method: 'POST',
      url: `/chat/conversations/${conversationId}/messages`,
      data: payload,
    });
  }

  async getMessages(conversationId: string, limit?: number) {
    return this.request<Record<string, unknown>>({
      method: 'GET',
      url: `/chat/conversations/${conversationId}/messages`,
      params: limit ? { limit } : undefined,
    });
  }

  async getMyConversations(userId: string) {
    return this.request<Record<string, unknown>>({
      method: 'GET',
      url: '/chat/my-conversations',
      headers: this.userHeaders(userId),
    });
  }

  async getHandovers(userId: string, unreadOnly?: boolean) {
    return this.request<Record<string, unknown>>({
      method: 'GET',
      url: '/chat/handovers',
      headers: this.userHeaders(userId),
      params: unreadOnly !== undefined ? { unreadOnly } : undefined,
    });
  }

  async acceptHandover(userId: string, notificationId: string) {
    return this.request<Record<string, unknown>>({
      method: 'POST',
      url: `/chat/handovers/${notificationId}/accept`,
      headers: this.userHeaders(userId),
    });
  }

  async sendProfessionalMessage(userId: string, conversationId: string, payload: { content: string }) {
    return this.request<Record<string, unknown>>({
      method: 'POST',
      url: `/chat/conversations/${conversationId}/professional-message`,
      headers: this.userHeaders(userId),
      data: payload,
    });
  }
}
