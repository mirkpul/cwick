import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3014),
  databaseUrl: process.env.DATABASE_URL,
  defaultNamespace: process.env.VECTOR_DEFAULT_NAMESPACE || 'default',
  maxResults: Number(process.env.VECTOR_MAX_RESULTS || 10),
  maxBatch: Number(process.env.VECTOR_MAX_BATCH || 100),
  rateLimit: {
    windowMs: Number(process.env.VECTOR_RATE_LIMIT_WINDOW_MS || 60000),
    max: Number(process.env.VECTOR_RATE_LIMIT_MAX || 120),
  },
};
