import { Response, NextFunction } from 'express';
import chatService from '../services/chatService';
import digitalTwinService from '../services/digitalTwinService';
import chatIntegrationService from '../services/chatIntegrationService';
import { AuthenticatedRequest } from '../middleware/auth';

class ChatController {
  async startConversation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { twinId } = req.params;
      const endUserData = req.body;

      if (chatIntegrationService.isEnabled()) {
        const result = await chatIntegrationService.startConversation(twinId, endUserData);
        res.status(201).json(result);
        return;
      }

      // Verify twin exists and is active
      const twin = await digitalTwinService.getDigitalTwinById(twinId);
      if (!twin) {
        res.status(404).json({ error: 'Digital twin not found' });
        return;
      }

      const conversation = await chatService.createConversation(twinId, endUserData);

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
        handoverTriggered: twinResponse.handoverTriggered,
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

      // Get user's twin
      const twin = await digitalTwinService.getDigitalTwinByUserId(userId);
      if (!twin) {
        res.status(404).json({ error: 'Digital twin not found' });
        return;
      }

      const conversations = await chatService.getConversationsByTwinId(twin.id);

      res.json({ conversations });
    } catch (error) {
      next(error);
    }
  }

  async getHandovers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const unreadOnly = req.query.unreadOnly === 'true';

      if (chatIntegrationService.isEnabled()) {
        const result = await chatIntegrationService.getHandovers(userId, unreadOnly);
        res.json(result);
        return;
      }

      const notifications = await chatService.getHandoverNotifications(userId, unreadOnly);

      res.json({ notifications });
    } catch (error) {
      next(error);
    }
  }

  async acceptHandover(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { notificationId } = req.params;

      if (chatIntegrationService.isEnabled()) {
        const result = await chatIntegrationService.acceptHandover(userId, notificationId);
        res.json(result);
        return;
      }

      const notification = await chatService.acceptHandover(notificationId, userId);

      res.json({
        message: 'Handover accepted',
        notification,
      });
    } catch (error) {
      next(error);
    }
  }

  async sendProfessionalMessage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { conversationId } = req.params;
      const { content } = req.body;

      if (chatIntegrationService.isEnabled()) {
        const result = await chatIntegrationService.sendProfessionalMessage(userId, conversationId, { content });
        res.json(result);
        return;
      }

      // Verify user owns this conversation's twin
      const twin = await digitalTwinService.getDigitalTwinByUserId(req.user!.userId);
      if (!twin) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }

      const message = await chatService.sendMessage(conversationId, 'professional', content);

      res.json({ message });
    } catch (error) {
      next(error);
    }
  }
}

export default new ChatController();
