import { Router } from 'express';
import chatController from '../controllers/chatController';
import { auth } from '../middleware/auth';
import { chatLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public routes (for end-users chatting with twins)
router.post('/conversations/:twinId/start', chatLimiter, chatController.startConversation.bind(chatController));
router.post('/conversations/:conversationId/messages', chatLimiter, chatController.sendMessage.bind(chatController));
router.get('/conversations/:conversationId/messages', chatController.getMessages.bind(chatController));

// Protected routes (for professionals managing conversations)
router.get('/my-conversations', auth, chatController.getMyConversations.bind(chatController));
router.get('/handovers', auth, chatController.getHandovers.bind(chatController));
router.post('/handovers/:notificationId/accept', auth, chatController.acceptHandover.bind(chatController));
router.post('/conversations/:conversationId/professional-message', auth, chatController.sendProfessionalMessage.bind(chatController));

export default router;
