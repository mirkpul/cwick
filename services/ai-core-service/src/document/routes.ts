import express, { Request, Response, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import type { ApiResponse } from '@virtualcoach/shared-types';
import { config } from './config';
import { processTextDocument, extractTextFromBuffer } from './processor';
import { logger } from './logger';
import { docQueue } from './queue';
import { query } from './db';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSizeBytes },
});

const allowedTypes = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export function buildRouter() {
  const router = express.Router();
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
  });
  router.use(limiter as unknown as RequestHandler);

  router.get('/health', (_req, res: Response<ApiResponse>) => {
    return res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        service: 'document-processing-service',
        version: '0.1.0',
        uptime: process.uptime(),
        timestamp: new Date(),
      },
    });
  });

  router.post('/ingest', upload.single('file'), async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { twinId } = req.body as { twinId?: string };
      const file = req.file;

      if (!twinId) {
        return res.status(400).json({ success: false, error: 'twinId is required' });
      }

      if (!file) {
        return res.status(400).json({ success: false, error: 'file is required' });
      }

      if (!allowedTypes.has(file.mimetype)) {
        return res.status(400).json({ success: false, error: 'Unsupported file type' });
      }

      if (config.asyncIngest) {
        const jobRow = await query<{ id: string }>(
          `INSERT INTO document_processing_jobs (twin_id, file_name, status)
           VALUES ($1, $2, 'pending') RETURNING id`,
          [twinId, file.originalname]
        );

        const jobId = jobRow.rows[0].id;
        await docQueue.add('ingest', {
          jobId,
          twinId,
          fileName: file.originalname,
          mimeType: file.mimetype,
          buffer: file.buffer.toString('base64'),
        });

        return res.status(202).json({ success: true, data: { jobId } });
      }

      const content = await extractTextFromBuffer(file.buffer, file.mimetype);
      const result = await processTextDocument({
        twinId,
        fileName: file.originalname,
        content,
        contentType: 'document',
      });

      return res.status(201).json({
        success: true,
        data: {
          fileName: file.originalname,
          entriesCreated: result.entriesCreated,
          chunks: result.chunks,
        },
      });
    } catch (error: any) {
      logger.error('Document ingest failed', { error: error.message });
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  router.get('/jobs/:id', async (req: Request, res: Response<ApiResponse>) => {
    const { id } = req.params;
    try {
      const result = await query(
        `SELECT id, status, result, created_at, updated_at, completed_at
         FROM document_processing_jobs
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Job not found' });
      }

      return res.status(200).json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      logger.error('Job fetch failed', { error: error.message });
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  });

  return router;
}
