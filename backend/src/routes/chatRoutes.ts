import { Router } from 'express';
import chatController from '../controllers/chatController';
import { auth } from '../middleware/auth';
import { chatLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public routes (for end-users chatting with knowledge bases)
router.post('/conversations/:kbId/start', chatLimiter, chatController.startConversation.bind(chatController));
router.post('/conversations/:conversationId/messages', chatLimiter, chatController.sendMessage.bind(chatController));
router.get('/conversations/:conversationId/messages', chatController.getMessages.bind(chatController));

// Protected routes (for KB owners managing conversations)
router.get('/my-conversations', auth, chatController.getMyConversations.bind(chatController));

export default router;
