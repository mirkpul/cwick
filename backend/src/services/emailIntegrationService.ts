import { EmailClient } from '@virtualcoach/sdk';

class EmailIntegrationService {
  private client: EmailClient | null;

  constructor() {
    const baseURL = process.env.EMAIL_SERVICE_URL;
    if (baseURL) {
      this.client = new EmailClient({
        baseURL,
      });
    } else {
      this.client = null;
    }
  }

  isEnabled(): boolean {
    return !!this.client;
  }

  private getClient(): EmailClient {
    if (!this.client) {
      throw new Error('Email service not configured');
    }
    return this.client;
  }

  async getGmailAuthUrl(userId: string) {
    return this.getClient().getGmailAuthUrl(userId);
  }

  async handleGmailCallback(code: string, state: string) {
    return this.getClient().handleGmailCallback({ code, state });
  }

  async getOutlookAuthUrl(userId: string) {
    return this.getClient().getOutlookAuthUrl(userId);
  }

  async handleOutlookCallback(code: string, state: string) {
    return this.getClient().handleOutlookCallback({ code, state });
  }

  async storeImapCredentials(
    userId: string,
    payload: { emailAddress: string; host: string; port: number | string; password: string }
  ) {
    return this.getClient().storeImapCredentials(userId, payload);
  }

  async triggerSync(userId: string, payload: { credentialId?: string; type?: string }) {
    return this.getClient().triggerSync(userId, payload);
  }

  async getSyncStatus(userId: string) {
    return this.getClient().getSyncStatus(userId);
  }

  async toggleAutoSync(userId: string, enabled: boolean) {
    return this.getClient().toggleAutoSync(userId, enabled);
  }

  async listEmails(userId: string, params: { limit?: number; offset?: number; search?: string } = {}) {
    return this.getClient().listEmails(userId, params);
  }

  async deleteEmail(userId: string, emailId: string) {
    return this.getClient().deleteEmail(userId, emailId);
  }

  async disconnectEmail(userId: string) {
    return this.getClient().disconnectEmail(userId);
  }

  async semanticSearch(userId: string, payload: { query: string; limit?: number; threshold?: number }) {
    return this.getClient().semanticSearch(userId, payload);
  }
}

export default new EmailIntegrationService();
