import express, { Request, Response, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import type { ApiResponse, RAGSearchRequest, RAGSearchResponse, SearchResult } from '@virtualcoach/shared-types';
import { VectorClient } from '@virtualcoach/sdk';
import { config } from './config';
import { logger } from './logger';
import { query } from './db';
import { getCached, setCached } from './cache';

const vectorClient = new VectorClient({ baseURL: config.vectorServiceUrl });

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
        service: 'rag-retrieval-service',
        version: '0.1.0',
        uptime: process.uptime(),
        timestamp: new Date(),
      },
    });
  });

  router.post('/search', async (req: Request, res: Response<ApiResponse<RAGSearchResponse>>) => {
    const body = req.body as (RAGSearchRequest & { userId?: string; queryVector?: number[] });
    if (!body.query || !body.twinId) {
      return res.status(400).json({ success: false, error: 'query and twinId are required' });
    }

    const limit = Math.min(body.maxResults || config.maxResults, config.maxResults);

    try {
      const vector = await vectorClient.search({ vector: [], namespace: 'noop', limit: 1 });
      void vector;
    } catch {}

    try {
      const cacheKey = JSON.stringify({ twinId: body.twinId, limit, vector: body.queryVector });
      const cached = getCached(cacheKey);
      if (cached) {
        return res.status(200).json({ success: true, data: cached });
      }

      const embedding = body.queryVector || null;

      if (!embedding) {
        return res.status(400).json({ success: false, error: 'queryVector is required' });
      }

      const [kbVector, emailVector] = await Promise.all([
        vectorClient.search({ vector: embedding, namespace: 'knowledge_base', limit: limit * 2 }),
        vectorClient.search({ vector: embedding, namespace: 'email', limit: limit * 2 }),
      ]);

      const kbIds = kbVector.map(r => r.id);
      const emailIds = emailVector.map(r => r.id);

      const kbResults: SearchResult[] = kbIds.length
        ? await (async () => {
            const placeholders = kbIds.map((_, idx) => `$${idx + 1}`).join(',');
            const result = await query(
              `SELECT id, content, file_name AS file_name, 'knowledge_base' as source_type, title
               FROM knowledge_base WHERE id IN (${placeholders})`,
              kbIds
            );
            const scoreMap = new Map(kbVector.map(r => [r.id, r.score || 0]));
            return result.rows.map(row => ({
              id: row.id,
              content: row.content,
              file_name: row.file_name,
              source_type: 'knowledge_base',
              score: scoreMap.get(row.id) || 0,
              metadata: { title: row.title },
            }));
          })()
        : [];

      const emailResults: SearchResult[] = emailIds.length
        ? await (async () => {
            const placeholders = emailIds.map((_, idx) => `$${idx + 1}`).join(',');
            const result = await query(
              `SELECT id, body_text AS content, subject AS title, sender_name, sender_email
               FROM email_knowledge WHERE id IN (${placeholders})`,
              emailIds
            );
            const scoreMap = new Map(emailVector.map(r => [r.id, r.score || 0]));
            return result.rows.map(row => ({
              id: row.id,
              content: row.content,
              source_type: 'email',
              score: scoreMap.get(row.id) || 0,
              metadata: {
                title: row.title,
                senderName: row.sender_name,
                senderEmail: row.sender_email,
              },
            }));
          })()
        : [];

      const weighted = [...kbResults, ...emailResults].map(result => {
        const baseScore = result.score || 0;
        const weight = result.source_type === 'email'
          ? config.scoring.weights.email
          : config.scoring.weights.knowledgeBase;
        return { ...result, score: baseScore * weight };
      });

      const filtered = weighted.filter(item => (item.score || 0) >= config.scoring.minScore);
      const results = filtered
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, limit);

      const response: RAGSearchResponse = {
        results,
        processingTimeMs: 0,
      };

      setCached(cacheKey, response);

      return res.status(200).json({ success: true, data: response });
    } catch (error: any) {
      logger.error('RAG retrieval failed', { error: error.message });
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  return router;
}
