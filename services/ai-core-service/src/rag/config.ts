import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3016),
  databaseUrl: process.env.DATABASE_URL,
  vectorServiceUrl: process.env.VECTOR_SERVICE_URL || 'http://localhost:3020',
  maxResults: Number(process.env.RAG_MAX_RESULTS || 10),
  rateLimit: {
    windowMs: Number(process.env.RAG_RATE_LIMIT_WINDOW_MS || 60000),
    max: Number(process.env.RAG_RATE_LIMIT_MAX || 120),
  },
  cache: {
    ttlMs: Number(process.env.RAG_CACHE_TTL_MS || 30000),
    maxEntries: Number(process.env.RAG_CACHE_MAX_ENTRIES || 200),
  },
  scoring: {
    minScore: Number(process.env.RAG_MIN_SCORE || 0),
    weights: {
      knowledgeBase: Number(process.env.RAG_WEIGHT_KB || 1),
      email: Number(process.env.RAG_WEIGHT_EMAIL || 1),
    },
  },
};
