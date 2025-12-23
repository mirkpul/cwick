import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './logger';

import { buildRouter as buildLlmRouter } from './llm/routes';
import { UsageTracker } from './llm/usageTracker';
import { config as llmConfig } from './llm/config';

import { buildRouter as buildVectorRouter } from './vector/routes';
import { shutdown as shutdownVectorDb } from './vector/db';

import { buildRouter as buildRagRouter } from './rag/routes';
import { shutdown as shutdownRagDb } from './rag/db';

import { buildRouter as buildDocumentRouter } from './document/routes';
import { shutdown as shutdownDocDb } from './document/db';
import { startWorker as startDocWorker } from './document/queue';
import { config as docConfig } from './document/config';

async function bootstrap() {
  const port = Number(process.env.AI_CORE_PORT || process.env.PORT || 3020);
  const app = express();

  app.use(cors());
  app.use(helmet());

  app.get('/health', (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        service: 'ai-core-service',
        version: '0.1.0',
        uptime: process.uptime(),
        timestamp: new Date(),
      },
    });
  });

  const usageTracker = new UsageTracker(llmConfig.databaseUrl);

  app.use(buildLlmRouter(usageTracker));
  app.use(buildVectorRouter());
  app.use(buildRagRouter());
  app.use(buildDocumentRouter());

  const server = app.listen(port, () => {
    logger.info(`AI Core Service listening on ${port}`);
  });

  const startWorkerFlag = docConfig.role === 'worker' || docConfig.role === 'api-worker';
  const worker = startWorkerFlag ? startDocWorker() : null;

  const close = async () => {
    logger.info('Shutting down AI Core Service...');
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (worker) {
      await worker.close();
    }
    await usageTracker.shutdown();
    await Promise.all([shutdownVectorDb(), shutdownRagDb(), shutdownDocDb()]);
    process.exit(0);
  };

  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}

bootstrap().catch(err => {
  logger.error('Failed to start AI Core Service', { error: err });
  process.exit(1);
});
