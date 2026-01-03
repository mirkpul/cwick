import { Router } from 'express';
import emailController from '../controllers/emailController';
import { auth, requireRole } from '../middleware/auth';

const router = Router();

// OAuth routes (no auth required for callbacks)
router.get('/auth/gmail', auth, requireRole(['kb_owner', 'super_admin']), emailController.getGmailAuthUrl.bind(emailController));
router.get('/auth/gmail/callback', emailController.handleGmailCallback.bind(emailController));

router.get('/auth/outlook', auth, requireRole(['kb_owner', 'super_admin']), emailController.getOutlookAuthUrl.bind(emailController));
router.get('/auth/outlook/callback', emailController.handleOutlookCallback.bind(emailController));

// All other routes require authentication
router.use(auth);
router.use(requireRole(['kb_owner', 'super_admin']));

// IMAP credentials
router.post('/auth/imap', emailController.storeImapCredentials.bind(emailController));

// Sync operations
router.post('/sync', emailController.triggerSync.bind(emailController));
router.get('/sync/status', emailController.getSyncStatus.bind(emailController));
router.put('/auto-sync', emailController.toggleAutoSync.bind(emailController));

// Email management
router.get('/list', emailController.listEmails.bind(emailController));
router.delete('/disconnect', emailController.disconnectEmail.bind(emailController));
router.delete('/:id', emailController.deleteEmail.bind(emailController));

// Search
router.post('/search', emailController.semanticSearch.bind(emailController));

export default router;
