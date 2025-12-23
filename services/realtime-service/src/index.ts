import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { buildRouter } from './routes';
import { config } from './config';
import logger from './config/logger';
import websocketService from './services/websocketService';
import { pool } from './config/database';

async function bootstrap() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  if (!config.jwtSecret) {
    logger.warn('JWT_SECRET is not set; professional WS auth will fail.');
  }

  const app = express();
  app.use(cors());
  app.use(helmet());
  app.use(buildRouter());

  const server = http.createServer(app);
  websocketService.initialize(server);

  const port = config.port;
  server.listen(port, () => {
    logger.info(`Realtime service listening on ${port}`);
    logger.info(`WebSocket available at ws://localhost:${port}/ws`);
  });

  const close = async () => {
    logger.info('Shutting down realtime service...');
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}

bootstrap().catch(err => {
  logger.error('Failed to start realtime service', { err });
  process.exit(1);
});
