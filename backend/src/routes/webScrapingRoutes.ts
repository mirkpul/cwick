import { Router } from 'express';
import { auth, requireRole } from '../middleware/auth';
import webScrapingController from '../controllers/webScrapingController';

const router = Router();

router.use(auth);
router.use(requireRole(['kb_owner', 'super_admin']));

router.get('/runs/:runId/screenshots/:filename', webScrapingController.getScreenshot.bind(webScrapingController));
router.get('/', webScrapingController.listSources.bind(webScrapingController));
router.post('/', webScrapingController.createSource.bind(webScrapingController));
router.get('/:sourceId/runs', webScrapingController.listRuns.bind(webScrapingController));
router.post('/:sourceId/run', webScrapingController.triggerScrape.bind(webScrapingController));
router.put('/:sourceId', webScrapingController.updateSource.bind(webScrapingController));
router.delete('/:sourceId', webScrapingController.deleteSource.bind(webScrapingController));

export default router;
