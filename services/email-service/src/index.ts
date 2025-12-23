import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { buildRouter } from './routes';
import { config } from './config';
import { logger } from './logger';
import { shutdown } from './db';

async function bootstrap() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  if (!config.encryptionKey) {
    throw new Error('ENCRYPTION_KEY is required');
  }

  const app = express();
  app.use(cors());
  app.use(helmet());
  app.use(buildRouter());

  const server = app.listen(config.port, () => {
    logger.info(`Email service listening on ${config.port}`);
  });

  const close = async () => {
    logger.info('Shutting down email service...');
    server.close(async () => {
      await shutdown();
      process.exit(0);
    });
  };

  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}

bootstrap().catch(err => {
  logger.error('Failed to start email service', { err });
  process.exit(1);
});
