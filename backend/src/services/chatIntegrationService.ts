import { ChatClient } from '@virtualcoach/sdk';

class ChatIntegrationService {
  private client: ChatClient | null;

  constructor() {
    const baseURL = process.env.REALTIME_SERVICE_URL;
    if (baseURL) {
      this.client = new ChatClient({
        baseURL,
      });
    } else {
      this.client = null;
    }
  }

  isEnabled(): boolean {
    return !!this.client;
  }

  private getClient(): ChatClient {
    if (!this.client) {
      throw new Error('Realtime service not configured');
    }
    return this.client;
  }

  async startConversation(twinId: string, payload: Record<string, unknown>) {
    return this.getClient().startConversation(twinId, payload);
  }

  async sendMessage(conversationId: string, payload: { content: string }) {
    return this.getClient().sendMessage(conversationId, payload);
  }

  async getMessages(conversationId: string, limit?: number) {
    return this.getClient().getMessages(conversationId, limit);
  }

  async getMyConversations(userId: string) {
    return this.getClient().getMyConversations(userId);
  }

  async getHandovers(userId: string, unreadOnly?: boolean) {
    return this.getClient().getHandovers(userId, unreadOnly);
  }

  async acceptHandover(userId: string, notificationId: string) {
    return this.getClient().acceptHandover(userId, notificationId);
  }

  async sendProfessionalMessage(userId: string, conversationId: string, payload: { content: string }) {
    return this.getClient().sendProfessionalMessage(userId, conversationId, payload);
  }
}

export default new ChatIntegrationService();
