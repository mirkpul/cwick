import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3015),
  databaseUrl: process.env.DATABASE_URL,
  maxFileSizeBytes: Number(process.env.DOC_PROCESSING_MAX_FILE_SIZE || 10 * 1024 * 1024),
  chunkSize: Number(process.env.DOC_PROCESSING_CHUNK_SIZE || 1500),
  chunkOverlap: Number(process.env.DOC_PROCESSING_CHUNK_OVERLAP || 150),
  llmGatewayUrl: process.env.LLM_GATEWAY_URL || 'http://localhost:3020',
  vectorServiceUrl: process.env.VECTOR_SERVICE_URL || 'http://localhost:3020',
  redisUrl: process.env.DOC_PROCESSING_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379',
  role: (process.env.DOC_PROCESSING_ROLE as 'api' | 'worker' | 'api-worker') || 'api-worker',
  asyncIngest: (process.env.DOC_PROCESSING_ASYNC || 'false').toLowerCase() === 'true',
  rateLimit: {
    windowMs: Number(process.env.DOC_PROCESSING_RATE_LIMIT_WINDOW_MS || 60000),
    max: Number(process.env.DOC_PROCESSING_RATE_LIMIT_MAX || 60),
  },
};
