import { Router } from 'express';
import knowledgeBaseController from '../controllers/knowledgeBaseController';
import { auth, requireRole } from '../middleware/auth';
import upload from '../middleware/upload';

const router = Router();

// All routes require authentication
router.use(auth);
router.use(requireRole(['kb_owner', 'super_admin']));

// Create knowledge base
router.post('/', knowledgeBaseController.create.bind(knowledgeBaseController));

// Get my knowledge base
router.get('/me', knowledgeBaseController.getMyKB.bind(knowledgeBaseController));

// Update knowledge base
router.put('/:kbId', knowledgeBaseController.update.bind(knowledgeBaseController));

// Knowledge base management - manual entries
router.post('/:kbId/knowledge', knowledgeBaseController.addKnowledge.bind(knowledgeBaseController));
router.get('/:kbId/knowledge', knowledgeBaseController.getKnowledge.bind(knowledgeBaseController));
router.delete('/:kbId/knowledge/:entryId', knowledgeBaseController.deleteKnowledge.bind(knowledgeBaseController));

// Knowledge base management - file uploads
router.post('/:kbId/knowledge/upload', upload.single('file'), knowledgeBaseController.uploadKnowledgeFile.bind(knowledgeBaseController));
router.get('/:kbId/knowledge/search', knowledgeBaseController.searchKnowledge.bind(knowledgeBaseController));
router.get('/:kbId/knowledge/files', knowledgeBaseController.listKnowledgeFiles.bind(knowledgeBaseController));
router.delete('/:kbId/knowledge/file/:entryId', knowledgeBaseController.deleteKnowledgeFile.bind(knowledgeBaseController));

// Context management
router.get('/:kbId/context/preview', knowledgeBaseController.previewContext.bind(knowledgeBaseController));
router.put('/:kbId/context', knowledgeBaseController.updateContext.bind(knowledgeBaseController));

// RAG Configuration
router.get('/:kbId/rag-config', knowledgeBaseController.getRAGConfig.bind(knowledgeBaseController));
router.put('/:kbId/rag-config', knowledgeBaseController.updateRAGConfig.bind(knowledgeBaseController));

export default router;
