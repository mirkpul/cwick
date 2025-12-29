// DEPRECATED: This service was for calling external realtime-service microservice
// Now integrated directly in chatService.ts
// Kept as stub for backwards compatibility

class ChatIntegrationService {
  isEnabled(): boolean {
    return false; // Microservice no longer used
  }

  async startConversation(_kbId: string, _payload: Record<string, unknown>) {
    throw new Error('Realtime service integration disabled - use chatService directly');
  }

  async sendMessage(_conversationId: string, _payload: { content: string }) {
    throw new Error('Realtime service integration disabled - use chatService directly');
  }

  async getMessages(_conversationId: string, _limit?: number) {
    throw new Error('Realtime service integration disabled - use chatService directly');
  }

  async getMyConversations(_userId: string) {
    throw new Error('Realtime service integration disabled - use chatService directly');
  }
}

export default new ChatIntegrationService();
