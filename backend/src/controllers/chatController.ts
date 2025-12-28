import { Response, NextFunction } from 'express';
import chatService from '../services/chatService';
import knowledgeBaseService from '../services/knowledgeBaseService';
import chatIntegrationService from '../services/chatIntegrationService';
import { AuthenticatedRequest } from '../middleware/auth';

class ChatController {
  async startConversation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { kbId } = req.params;
      const endUserData = req.body;

      if (chatIntegrationService.isEnabled()) {
        const result = await chatIntegrationService.startConversation(kbId, endUserData);
        res.status(201).json(result);
        return;
      }

      // Verify knowledge base exists and is active
      const kb = await knowledgeBaseService.getKnowledgeBaseById(kbId);
      if (!kb) {
        res.status(404).json({ error: 'Knowledge base not found' });
        return;
      }

      const conversation = await chatService.createConversation(kbId, endUserData);

      res.status(201).json({
        message: 'Conversation started',
        conversation,
      });
    } catch (error) {
      next(error);
    }
  }

  async sendMessage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { conversationId } = req.params;
      const { content } = req.body;

      if (chatIntegrationService.isEnabled()) {
        const result = await chatIntegrationService.sendMessage(conversationId, { content });
        res.json(result);
        return;
      }

      // Save user message
      const userMessage = await chatService.sendMessage(conversationId, 'user', content);
      console.log(`[DEBUG] User message saved: ${userMessage.id}, content: "${content.substring(0, 50)}..."`);

      // Generate and save twin response
      console.log(`[DEBUG] Calling generateTwinResponse for conversation ${conversationId}`);
      const twinResponse = await chatService.generateTwinResponse(conversationId, userMessage.content);

      res.json({
        userMessage,
        twinResponse: twinResponse.message,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMessages(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { conversationId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      if (chatIntegrationService.isEnabled()) {
        const result = await chatIntegrationService.getMessages(conversationId, limit);
        res.json(result);
        return;
      }

      const messages = await chatService.getConversationMessages(conversationId, limit);

      res.json({ messages });
    } catch (error) {
      next(error);
    }
  }

  async getMyConversations(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;

      if (chatIntegrationService.isEnabled()) {
        const result = await chatIntegrationService.getMyConversations(userId);
        res.json(result);
        return;
      }

      // Get user's knowledge base
      const kb = await knowledgeBaseService.getKnowledgeBaseByUserId(userId);
      if (!kb) {
        res.status(404).json({ error: 'Knowledge base not found' });
        return;
      }

      const conversations = await chatService.getConversationsByKbId(kb.id);

      res.json({ conversations });
    } catch (error) {
      next(error);
    }
  }

}

export default new ChatController();
