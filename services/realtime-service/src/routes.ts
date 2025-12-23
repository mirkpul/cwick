import express, { Request, Response } from 'express';
import type { ApiResponse } from '@virtualcoach/shared-types';
import logger from './config/logger';
import chatService from './services/chatService';
import digitalTwinService from './services/digitalTwinService';

function requireUserId(req: Request, res: Response<ApiResponse>): string | null {
  const userId = req.header('x-user-id');
  if (!userId) {
    res.status(401).json({ success: false, error: 'x-user-id header required' });
    return null;
  }
  return userId;
}

export function buildRouter() {
  const router = express.Router();
  router.use(express.json({ limit: '2mb' }));

  router.get('/health', (_req, res: Response<ApiResponse>) => {
    return res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        service: 'realtime-service',
        version: '0.1.0',
        uptime: process.uptime(),
        timestamp: new Date(),
      },
    });
  });

  router.post('/chat/conversations/:twinId/start', async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { twinId } = req.params;
      const endUserData = req.body;

      const twin = await digitalTwinService.getDigitalTwinById(twinId);
      if (!twin) {
        return res.status(404).json({ success: false, error: 'Digital twin not found' });
      }

      const conversation = await chatService.createConversation(twinId, endUserData);

      return res.status(201).json({
        success: true,
        data: {
          message: 'Conversation started',
          conversation,
        },
      });
    } catch (error) {
      logger.error('Start conversation failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to start conversation' });
    }
  });

  router.post('/chat/conversations/:conversationId/messages', async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { conversationId } = req.params;
      const { content } = req.body as { content?: string };
      if (!content) {
        return res.status(400).json({ success: false, error: 'content is required' });
      }
      if (!content) {
        return res.status(400).json({ success: false, error: 'content is required' });
      }

      const userMessage = await chatService.sendMessage(conversationId, 'user', content);
      const twinResponse = await chatService.generateTwinResponse(conversationId, userMessage.content);

      return res.status(200).json({
        success: true,
        data: {
          userMessage,
          twinResponse: twinResponse.message,
          handoverTriggered: twinResponse.handoverTriggered,
        },
      });
    } catch (error) {
      logger.error('Send message failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to send message' });
    }
  });

  router.get('/chat/conversations/:conversationId/messages', async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { conversationId } = req.params;
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const messages = await chatService.getConversationMessages(conversationId, limit);
      return res.status(200).json({ success: true, data: { messages } });
    } catch (error) {
      logger.error('Get messages failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to get messages' });
    }
  });

  router.get('/chat/my-conversations', async (req: Request, res: Response<ApiResponse>) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    try {
      const twin = await digitalTwinService.getDigitalTwinByUserId(userId);
      if (!twin) {
        return res.status(404).json({ success: false, error: 'Digital twin not found' });
      }

      const conversations = await chatService.getConversationsByTwinId(twin.id);
      return res.status(200).json({ success: true, data: { conversations } });
    } catch (error) {
      logger.error('Get my conversations failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to get conversations' });
    }
  });

  router.get('/chat/handovers', async (req: Request, res: Response<ApiResponse>) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    try {
      const unreadOnly = req.query.unreadOnly === 'true';
      const notifications = await chatService.getHandoverNotifications(userId, unreadOnly);
      return res.status(200).json({ success: true, data: { notifications } });
    } catch (error) {
      logger.error('Get handovers failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to get handovers' });
    }
  });

  router.post('/chat/handovers/:notificationId/accept', async (req: Request, res: Response<ApiResponse>) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    try {
      const { notificationId } = req.params;
      const notification = await chatService.acceptHandover(notificationId, userId);
      return res.status(200).json({
        success: true,
        data: {
          message: 'Handover accepted',
          notification,
        },
      });
    } catch (error) {
      logger.error('Accept handover failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to accept handover' });
    }
  });

  router.post('/chat/conversations/:conversationId/professional-message', async (req: Request, res: Response<ApiResponse>) => {
    const userId = requireUserId(req, res);
    if (!userId) return;
    try {
      const { conversationId } = req.params;
      const { content } = req.body as { content?: string };
      if (!content) {
        return res.status(400).json({ success: false, error: 'content is required' });
      }

      const twin = await digitalTwinService.getDigitalTwinByUserId(userId);
      if (!twin) {
        return res.status(403).json({ success: false, error: 'Unauthorized' });
      }

      const message = await chatService.sendMessage(conversationId, 'professional', content);
      return res.status(200).json({ success: true, data: { message } });
    } catch (error) {
      logger.error('Send professional message failed', { error });
      return res.status(500).json({ success: false, error: 'Failed to send professional message' });
    }
  });

  return router;
}
