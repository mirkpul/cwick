import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { buildRouter } from './routes';
import { config } from './config';
import { logger } from './logger';
import { shutdown } from './db';
import { startWorker } from './queue';
import { startScheduler } from './scheduler';

async function bootstrap() {
  const role = config.role;
  const startApi = role === 'api' || role === 'api-worker';
  const startWorkerFlag = role === 'worker' || role === 'api-worker';

  let server: import('http').Server | null = null;
  let worker: any = null;
  let scheduler: NodeJS.Timeout | null = null;

  if (startApi) {
    const app = express();
    app.use(cors());
    app.use(helmet());
    app.use(buildRouter());

    server = app.listen(config.port, () => {
      logger.info(`Web Scraping Service listening on ${config.port}`);
    });
  }

  if (startWorkerFlag) {
    worker = startWorker();
    scheduler = startScheduler();
  }

  const close = async () => {
    logger.info('Shutting down web scraping service...');
    if (server) {
      await new Promise<void>(resolve => server!.close(() => resolve()));
    }
    if (scheduler) {
      clearInterval(scheduler);
    }
    if (worker) {
      await worker.close();
    }
    await shutdown();
    process.exit(0);
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}

bootstrap().catch(err => {
  logger.error('Failed to start web scraping service', { err });
  process.exit(1);
});
