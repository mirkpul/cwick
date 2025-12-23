import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import digitalTwinService from '../services/digitalTwinService';
import webScrapingService, { WebSourceInput } from '../services/webScrapingService';
import logger from '../config/logger';

class WebScrapingController {
  private async requireTwin(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return null;
    }

    const twin = await digitalTwinService.getDigitalTwinByUserId(req.user.userId);
    if (!twin) {
      res.status(404).json({ error: 'Digital twin not found' });
      return null;
    }

    return twin;
  }

  async listSources(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const twin = await this.requireTwin(req, res);
      if (!twin) return;

      const sources = await webScrapingService.listSources(twin.id);
      res.json({ sources });
    } catch (error) {
      logger.error('Failed to list web sources', { error });
      res.status(500).json({ error: 'Unable to load web sources' });
    }
  }

  async listRuns(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const twin = await this.requireTwin(req, res);
      if (!twin) return;

      const { sourceId } = req.params;
      const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10) || 20, 50);
      const runs = await webScrapingService.listRuns(twin.id, sourceId, limit);
      res.json({ runs });
    } catch (error) {
      logger.error('Failed to list web scrape runs', { error });
      res.status(500).json({ error: 'Unable to load scrape history' });
    }
  }

  async createSource(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const twin = await this.requireTwin(req, res);
      if (!twin) return;

      const payload = req.body as WebSourceInput;
      const source = await webScrapingService.createSource(twin.id, payload);
      res.status(201).json({ source });
    } catch (error) {
      logger.error('Failed to create web source', { error });
      res.status(400).json({
        error: (error as Error).message || 'Unable to create web source',
      });
    }
  }

  async updateSource(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const twin = await this.requireTwin(req, res);
      if (!twin) return;

      const { sourceId } = req.params;
      const payload = req.body as Partial<WebSourceInput>;
      const source = await webScrapingService.updateSource(twin.id, sourceId, payload);
      res.json({ source });
    } catch (error) {
      logger.error('Failed to update web source', { error });
      const message = (error as Error).message || 'Unable to update web source';
      const status = message === 'Web source not found' ? 404 : 400;
      res.status(status).json({ error: message });
    }
  }

  async deleteSource(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const twin = await this.requireTwin(req, res);
      if (!twin) return;

      const { sourceId } = req.params;
      await webScrapingService.deleteSource(twin.id, sourceId);
      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete web source', { error });
      const message = (error as Error).message || 'Unable to delete web source';
      const status = message === 'Web source not found' ? 404 : 500;
      res.status(status).json({ error: message });
    }
  }

  async triggerScrape(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const twin = await this.requireTwin(req, res);
      if (!twin) return;

      const { sourceId } = req.params;
      const result = await webScrapingService.triggerScrape(twin.id, twin.llm_provider, sourceId, 'manual');
      res.json({
        message: 'Scrape started',
        run: result,
      });
    } catch (error) {
      logger.error('Failed to trigger web scrape', { error });
      const message = (error as Error).message || 'Unable to trigger scrape';
      const status = message === 'Web source not found' ? 404 : 500;
      res.status(status).json({ error: message });
    }
  }

  async getScreenshot(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const twin = await this.requireTwin(req, res);
      if (!twin) return;

      const { runId } = req.params;
      const { data, contentType } = await webScrapingService.downloadScreenshot(runId);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${runId}.png"`);
      res.send(data);
    } catch (error) {
      const message = (error as Error).message;
      const status = message === 'Screenshot not found' ? 404 : 500;
      res.status(status).json({ error: message });
    }
  }
}

export default new WebScrapingController();
