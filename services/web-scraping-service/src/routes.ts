import express, { Request, Response } from 'express';
import type {
  ApiResponse,
  CreateWebSourceRequest,
  TriggerScrapeRequest,
  WebSource,
  WebScrapeRun,
} from '@virtualcoach/shared-types';
import { query } from './db';
import { logger } from './logger';
import { config } from './config';
import { getScreenshotPath } from './scraper';
import { scrapeQueue } from './queue';
import fs from 'fs';

const computeNextRun = (hours?: number): Date => {
  const safeHours = Math.max(1, Math.min(168, hours || 24));
  return new Date(Date.now() + safeHours * 60 * 60 * 1000);
};

async function getSource(twinId: string, sourceId: string): Promise<WebSource | null> {
  const result = await query<WebSource>(
    `SELECT * FROM web_sources WHERE id = $1 AND twin_id = $2 AND is_active = true`,
    [sourceId, twinId]
  );
  return result.rows[0] || null;
}

async function listRuns(sourceId: string, twinId: string, limit: number): Promise<WebScrapeRun[]> {
  const result = await query<WebScrapeRun>(
    `SELECT r.* FROM web_scrape_runs r
     JOIN web_sources s ON s.id = r.source_id
     WHERE s.id = $1 AND s.twin_id = $2
     ORDER BY r.started_at DESC
     LIMIT $3`,
    [sourceId, twinId, limit]
  );
  return result.rows;
}

export function buildRouter() {
  const router = express.Router();

  router.use((req, res, next) => {
    if (config.role === 'worker') {
      return res.status(503).json({ success: false, error: 'Service in worker-only mode' });
    }
    return next();
  });

  router.use(express.json({ limit: '1mb' }));

  router.get('/health', (req, res: Response<ApiResponse>) => {
    return res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        service: 'web-scraping-service',
        version: '0.1.0',
        uptime: process.uptime(),
        timestamp: new Date(),
      },
    });
  });

  router.get('/sources', async (req: Request, res: Response<ApiResponse<WebSource[]>>) => {
    const twinId = req.query.twinId as string;
    if (!twinId) {
      return res.status(400).json({ success: false, error: 'twinId is required' });
    }
    try {
      const result = await query<WebSource>(
        `SELECT * FROM web_sources WHERE twin_id = $1 AND is_active = true ORDER BY created_at DESC`,
        [twinId]
      );
      return res.status(200).json({ success: true, data: result.rows });
    } catch (error: any) {
      logger.error('list sources failed', { error: error.message });
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  router.get('/sources/:sourceId/runs', async (req: Request, res: Response<ApiResponse<WebScrapeRun[]>>) => {
    const twinId = req.query.twinId as string;
    const { sourceId } = req.params;
    const limit = parseInt((req.query.limit as string) || '20', 10);
    if (!twinId) {
      return res.status(400).json({ success: false, error: 'twinId is required' });
    }
    try {
      const runs = await listRuns(sourceId, twinId, limit);
      return res.status(200).json({ success: true, data: runs });
    } catch (error: any) {
      logger.error('list runs failed', { error: error.message });
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  router.post('/sources', async (req: Request, res: Response<ApiResponse<WebSource>>) => {
    const body = req.body as CreateWebSourceRequest & { twinId?: string };
    const twinId = body.twinId;
    if (!twinId) return res.status(400).json({ success: false, error: 'twinId is required' });

    try {
      const nextRun = body.autoRefresh ? computeNextRun(body.refreshFrequencyHours) : null;
      const result = await query<WebSource>(
        `INSERT INTO web_sources (twin_id, name, base_url, scrape_strategy, crawl_depth, max_pages, auto_refresh_enabled, schedule_frequency_hours, include_paths, exclude_paths, config, next_run_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [
          twinId,
          body.name,
          body.url,
          'single_page',
          1,
          20,
          body.autoRefresh || false,
          body.refreshFrequencyHours || 24,
          [],
          [],
          JSON.stringify({ cssSelectors: body.cssSelectors || [], notes: body.name }),
          nextRun,
        ]
      );
      return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      logger.error('create source failed', { error: error.message });
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  router.put('/sources/:sourceId', async (req: Request, res: Response<ApiResponse<WebSource>>) => {
    const { sourceId } = req.params;
    const body = req.body as Partial<CreateWebSourceRequest> & { twinId?: string };
    if (!body.twinId) return res.status(400).json({ success: false, error: 'twinId is required' });
    const existing = await getSource(body.twinId, sourceId);
    if (!existing) return res.status(404).json({ success: false, error: 'Source not found' });

    try {
      const autoRefresh = body.autoRefresh ?? existing.auto_refresh_enabled;
      const refreshHours = body.refreshFrequencyHours ?? existing.schedule_frequency_hours ?? 24;
      const nextRun = autoRefresh ? computeNextRun(refreshHours) : null;

      const result = await query<WebSource>(
        `UPDATE web_sources SET
          name = COALESCE($1, name),
          base_url = COALESCE($2, base_url),
          scrape_strategy = COALESCE($3, scrape_strategy),
          crawl_depth = COALESCE($4, crawl_depth),
          max_pages = COALESCE($5, max_pages),
          auto_refresh_enabled = COALESCE($6, auto_refresh_enabled),
          schedule_frequency_hours = COALESCE($7, schedule_frequency_hours),
          include_paths = COALESCE($8, include_paths),
          exclude_paths = COALESCE($9, exclude_paths),
          config = COALESCE($10, config),
          next_run_at = $11
         WHERE id = $12 AND twin_id = $13
         RETURNING *`,
        [
          body.name,
          body.url,
          null,
          null,
          null,
          autoRefresh,
          refreshHours,
          null,
          null,
          body.cssSelectors ? JSON.stringify({ cssSelectors: body.cssSelectors }) : null,
          nextRun,
          sourceId,
          body.twinId,
        ]
      );
      return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      logger.error('update source failed', { error: error.message });
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  router.delete('/sources/:sourceId', async (req: Request, res: Response<ApiResponse>) => {
    const { sourceId } = req.params;
    const twinId = req.query.twinId as string;
    if (!twinId) return res.status(400).json({ success: false, error: 'twinId is required' });

    try {
      await query(`UPDATE web_sources SET is_active = false WHERE id = $1 AND twin_id = $2`, [sourceId, twinId]);
      return res.status(200).json({ success: true, message: 'Deleted' });
    } catch (error: any) {
      logger.error('delete source failed', { error: error.message });
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  router.post('/sources/:sourceId/scrape', async (req: Request, res: Response<ApiResponse<{ runId: string }>>) => {
    const body = req.body as TriggerScrapeRequest & { twinId?: string };
    const { sourceId } = req.params;
    const twinId = body.twinId;
    if (!twinId) return res.status(400).json({ success: false, error: 'twinId is required' });

    try {
      const source = await getSource(twinId, sourceId);
      if (!source) return res.status(404).json({ success: false, error: 'Source not found' });

      const run = await query<{ id: string }>(
        `INSERT INTO web_scrape_runs (source_id, status, trigger_type, pages_processed, entries_added)
         VALUES ($1, $2, $3, 0, 0) RETURNING id`,
        [sourceId, 'pending', body.force ? 'manual' : 'auto']
      );

      await scrapeQueue.add('scrape', { runId: run.rows[0].id, url: source.base_url });

      return res.status(202).json({ success: true, data: { runId: run.rows[0].id } });
    } catch (error: any) {
      logger.error('trigger scrape failed', { error: error.message });
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  router.get('/runs/:runId/screenshot', async (req: Request, res: Response) => {
    if (!config.screenshotsEnabled) {
      return res.status(404).json({ success: false, error: 'Screenshots are disabled' });
    }
    const { runId } = req.params;
    const path = getScreenshotPath(runId);
    if (!fs.existsSync(path)) {
      return res.status(404).json({ success: false, error: 'Screenshot not found' });
    }
    return res.sendFile(path);
  });

  return router;
}
