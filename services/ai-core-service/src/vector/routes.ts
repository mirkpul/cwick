import express, { Request, Response, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import type { ApiResponse, VectorBatchUpsertRequest, VectorUpsertRequest, VectorSearchRequest, VectorSearchResult } from '@virtualcoach/shared-types';
import { config } from './config';
import { logger } from './logger';
import { query } from './db';

function toPgVector(vec: number[]): string {
  return '[' + vec.join(',') + ']';
}

export function buildRouter() {
  const router = express.Router();
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
  });
  router.use(limiter as unknown as RequestHandler);
  router.use(express.json({ limit: '2mb' }));

  router.get('/health', (_req, res: Response<ApiResponse>) => {
    return res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        service: 'vector-service',
        version: '0.1.0',
        uptime: process.uptime(),
        timestamp: new Date(),
      },
    });
  });

  router.post('/vectors/upsert', async (req: Request, res: Response<ApiResponse>) => {
    const body = req.body as VectorUpsertRequest;
    if (!body.id || !body.vector || body.vector.length === 0) {
      return res.status(400).json({ success: false, error: 'id and vector are required' });
    }
    const namespace = body.namespace || config.defaultNamespace;
    try {
      await query(
        `INSERT INTO vector_store (id, namespace, vector, metadata)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id)
         DO UPDATE SET vector = EXCLUDED.vector, metadata = EXCLUDED.metadata, updated_at = CURRENT_TIMESTAMP`,
        [body.id, namespace, toPgVector(body.vector), body.metadata || {}]
      );
      return res.status(200).json({ success: true, message: 'Upserted' } as ApiResponse);
    } catch (error: any) {
      logger.error('Upsert failed', { error: error.message });
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  router.post('/vectors/batch-upsert', async (req: Request, res: Response<ApiResponse>) => {
    const body = req.body as VectorBatchUpsertRequest;
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return res.status(400).json({ success: false, error: 'items are required' });
    }
    if (body.items.length > config.maxBatch) {
      return res.status(400).json({ success: false, error: `batch size exceeds ${config.maxBatch}` });
    }
    const ids = new Set<string>();
    for (const item of body.items) {
      if (!item.id || !item.vector || item.vector.length === 0) {
        return res.status(400).json({ success: false, error: 'each item requires id and vector' });
      }
      if (ids.has(item.id)) {
        return res.status(400).json({ success: false, error: `duplicate id in batch: ${item.id}` });
      }
      ids.add(item.id);
    }

    const params: any[] = [];
    const values: string[] = [];
    body.items.forEach((item, index) => {
      const base = index * 4;
      const namespace = item.namespace || config.defaultNamespace;
      params.push(item.id, namespace, toPgVector(item.vector), item.metadata || {});
      values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
    });

    try {
      await query(
        `INSERT INTO vector_store (id, namespace, vector, metadata)
         VALUES ${values.join(',')}
         ON CONFLICT (id)
         DO UPDATE SET vector = EXCLUDED.vector, metadata = EXCLUDED.metadata, updated_at = CURRENT_TIMESTAMP`,
        params
      );
      return res.status(200).json({ success: true, message: 'Batch upserted' } as ApiResponse);
    } catch (error: any) {
      logger.error('Batch upsert failed', { error: error.message });
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  router.post('/vectors/search', async (req: Request, res: Response<ApiResponse<{ results: VectorSearchResult[] }>>) => {
    const body = req.body as VectorSearchRequest;
    if (!body.vector || body.vector.length === 0) {
      return res.status(400).json({ success: false, error: 'vector is required' });
    }
    const namespace = body.namespace || config.defaultNamespace;
    const limit = Math.min(body.limit || config.maxResults, config.maxResults);
    try {
      const result = await query<VectorSearchResult>(
        `SELECT id, metadata, 1 - (vector <=> $1::vector) AS score
         FROM vector_store
         WHERE namespace = $2
         ORDER BY vector <=> $1::vector
         LIMIT $3`,
        [toPgVector(body.vector), namespace, limit]
      );
      return res.status(200).json({ success: true, data: { results: result.rows } });
    } catch (error: any) {
      logger.error('Search failed', { error: error.message });
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  router.delete('/vectors/:id', async (req: Request, res: Response<ApiResponse>) => {
    const { id } = req.params;
    try {
      await query(`DELETE FROM vector_store WHERE id = $1`, [id]);
      return res.status(200).json({ success: true, message: 'Deleted' } as ApiResponse);
    } catch (error: any) {
      logger.error('Delete failed', { error: error.message });
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  return router;
}
