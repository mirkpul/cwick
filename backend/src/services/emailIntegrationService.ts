// DEPRECATED: This service was for calling external email-service microservice
// Now integrated directly in emailSyncService.ts, gmailConnector.ts, etc.
// Kept as stub for backwards compatibility

class EmailIntegrationService {
  isEnabled(): boolean {
    return false; // Microservice no longer used
  }

  async getGmailAuthUrl(_userId: string): Promise<{ authUrl: string }> {
    throw new Error('Email service integration disabled - use emailAuthService directly');
  }

  async handleGmailCallback(_code: string, _state: string): Promise<{ success: boolean }> {
    throw new Error('Email service integration disabled - use emailAuthService directly');
  }

  async getOutlookAuthUrl(_userId: string): Promise<{ authUrl: string }> {
    throw new Error('Email service integration disabled - use emailAuthService directly');
  }

  async handleOutlookCallback(_code: string, _state: string): Promise<{ success: boolean }> {
    throw new Error('Email service integration disabled - use emailAuthService directly');
  }

  async storeImapCredentials(
    _userId: string,
    _payload: { emailAddress: string; host: string; port: number | string; password: string }
  ): Promise<{ credentialId: string }> {
    throw new Error('Email service integration disabled - use emailAuthService directly');
  }

  async triggerSync(_userId: string, _payload: { credentialId?: string; type?: string }): Promise<{ syncType: string }> {
    throw new Error('Email service integration disabled - use emailSyncService directly');
  }

  async getSyncStatus(_userId: string): Promise<{ status: string }> {
    throw new Error('Email service integration disabled - use emailSyncService directly');
  }

  async toggleAutoSync(_userId: string, _enabled: boolean): Promise<{ autoSyncEnabled: boolean }> {
    throw new Error('Email service integration disabled - use emailSyncService directly');
  }

  async listEmails(_userId: string, _params: { limit?: number; offset?: number; search?: string } = {}): Promise<unknown[]> {
    throw new Error('Email service integration disabled - use emailSyncService directly');
  }

  async deleteEmail(_userId: string, _emailId: string): Promise<void> {
    throw new Error('Email service integration disabled - use emailSyncService directly');
  }

  async disconnectEmail(_userId: string): Promise<void> {
    throw new Error('Email service integration disabled - use emailAuthService directly');
  }

  async semanticSearch(_userId: string, _payload: { query: string; limit?: number; threshold?: number }): Promise<unknown[]> {
    throw new Error('Email service integration disabled - use chatService RAG search directly');
  }
}

export default new EmailIntegrationService();
