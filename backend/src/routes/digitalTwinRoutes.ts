import { Router } from 'express';
import digitalTwinController from '../controllers/digitalTwinController';
import { auth, requireRole } from '../middleware/auth';
import upload from '../middleware/upload';

const router = Router();

// All routes require authentication
router.use(auth);
router.use(requireRole(['professional', 'super_admin']));

// Create digital twin
router.post('/', digitalTwinController.create.bind(digitalTwinController));

// Get my digital twin
router.get('/me', digitalTwinController.getMyTwin.bind(digitalTwinController));

// Update digital twin
router.put('/:twinId', digitalTwinController.update.bind(digitalTwinController));

// Knowledge base management - manual entries
router.post('/:twinId/knowledge', digitalTwinController.addKnowledge.bind(digitalTwinController));
router.get('/:twinId/knowledge', digitalTwinController.getKnowledge.bind(digitalTwinController));
router.delete('/:twinId/knowledge/:entryId', digitalTwinController.deleteKnowledge.bind(digitalTwinController));

// Knowledge base management - file uploads
router.post('/:twinId/knowledge/upload', upload.single('file'), digitalTwinController.uploadKnowledgeFile.bind(digitalTwinController));
router.get('/:twinId/knowledge/search', digitalTwinController.searchKnowledge.bind(digitalTwinController));
router.get('/:twinId/knowledge/files', digitalTwinController.listKnowledgeFiles.bind(digitalTwinController));
router.delete('/:twinId/knowledge/file/:entryId', digitalTwinController.deleteKnowledgeFile.bind(digitalTwinController));

// Context management
router.get('/:twinId/context/preview', digitalTwinController.previewContext.bind(digitalTwinController));
router.put('/:twinId/context', digitalTwinController.updateContext.bind(digitalTwinController));

// RAG Configuration
router.get('/:twinId/rag-config', digitalTwinController.getRAGConfig.bind(digitalTwinController));
router.put('/:twinId/rag-config', digitalTwinController.updateRAGConfig.bind(digitalTwinController));

export default router;
