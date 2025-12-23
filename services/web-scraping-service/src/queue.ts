// Using loose typings to avoid hard dependency on @types when offline install fails
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Queue, Worker } = require('bullmq');
import { config } from './config';
import { logger } from './logger';
import { runScrape } from './scraper';

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

export const scrapeQueue = new Queue('scrape', connection);

export function startWorker(): any {
  const worker = new Worker(
    'scrape',
    async (job: any) => {
      const { runId, url } = job.data;
      await runScrape(runId, url);
    },
    { ...connection, concurrency: config.concurrency }
  );

  worker.on('completed', (job: any) => {
    logger.info('Scrape job completed', { jobId: job.id });
  });

  worker.on('failed', (job: any, err: Error) => {
    logger.error('Scrape job failed', { jobId: job?.id, error: err?.message });
  });

  return worker;
}
