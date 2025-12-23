import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import logger from './config/logger';
import errorHandler from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';
import websocketService from './services/websocketService';

// Import routes
import authRoutes from './routes/authRoutes';
import digitalTwinRoutes from './routes/digitalTwinRoutes';
import chatRoutes from './routes/chatRoutes';
import emailRoutes from './routes/emailRoutes';
import benchmarkRoutes from './routes/benchmarkRoutes';
import webScrapingRoutes from './routes/webScrapingRoutes';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Trust proxy for rate limiting behind Nginx/Load Balancer
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(generalLimiter);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/digital-twins', digitalTwinRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/benchmark', benchmarkRoutes);
app.use('/api/web-scraping', webScrapingRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler (must be last)
app.use(errorHandler);

// Initialize WebSocket server (unless delegated to realtime-service)
if (!process.env.REALTIME_SERVICE_URL) {
  websocketService.initialize(server);
}

// Start server
const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    if (!process.env.REALTIME_SERVICE_URL) {
      logger.info(`WebSocket server available at ws://localhost:${PORT}/ws`);
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export { app, server };
