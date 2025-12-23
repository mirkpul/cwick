// loose typing to avoid install blockers for bullmq types
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Queue, Worker } = require('bullmq');
import { config } from './config';
import { logger } from './logger';
import { processTextDocument, extractTextFromBuffer } from './processor';
import { query } from './db';

function buildRedisConnection(url: string) {
  const parsed = new URL(url);
  const port = parsed.port ? Number(parsed.port) : 6379;
  const options: Record<string, unknown> = {
    host: parsed.hostname,
    port: Number.isNaN(port) ? 6379 : port,
  };

  if (parsed.username) {
    options.username = parsed.username;
  }
  if (parsed.password) {
    options.password = parsed.password;
  }
  if (parsed.protocol === 'rediss:') {
    options.tls = {};
  }
  if (parsed.pathname && parsed.pathname !== '/') {
    const db = Number(parsed.pathname.slice(1));
    if (!Number.isNaN(db)) {
      options.db = db;
    }
  }

  return options;
}

const connection = { connection: buildRedisConnection(config.redisUrl) };

export const docQueue = new Queue('document-processing', connection);

async function markJob(id: string, status: string, payload?: Record<string, unknown>) {
  const isTerminal = status === 'completed' || status === 'failed';
  await query(
    `UPDATE document_processing_jobs
     SET status = $1,
         result = COALESCE($2, result),
         updated_at = CURRENT_TIMESTAMP,
         completed_at = CASE WHEN $4 THEN CURRENT_TIMESTAMP ELSE completed_at END
     WHERE id = $3`,
    [status, payload ? JSON.stringify(payload) : null, id, isTerminal]
  );
}

export function startWorker(): any {
  const worker = new Worker(
    'document-processing',
    async (job: any) => {
      const { jobId, twinId, fileName, mimeType, buffer } = job.data as { jobId: string; twinId: string; fileName: string; mimeType: string; buffer: string };
      try {
        await markJob(jobId, 'processing');
        const content = await extractTextFromBuffer(Buffer.from(buffer, 'base64'), mimeType);
        const result = await processTextDocument({ twinId, fileName, content, contentType: 'document' });
        await markJob(jobId, 'completed', { ...result, fileName });
      } catch (error: any) {
        logger.error('Document job failed', {
          error: error?.message || 'unknown error',
          stack: error?.stack,
          jobId,
          twinId,
          fileName,
          mimeType,
        });
        await markJob(jobId, 'failed', {
          error: error?.message || 'unknown error',
          stack: error?.stack,
        });
      }
    },
    { ...connection, concurrency: 1 }
  );

  worker.on('completed', (job: any) => {
    logger.info('Document job completed', { jobId: job.id });
  });

  worker.on('failed', (job: any, err: Error) => {
    logger.error('Document job failed', { jobId: job?.id, error: err?.message });
  });

  return worker;
}
