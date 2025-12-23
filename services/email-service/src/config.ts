import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3017),
  databaseUrl: process.env.DATABASE_URL,
  encryptionKey: process.env.ENCRYPTION_KEY,
  llmGatewayUrl: process.env.LLM_GATEWAY_URL || 'http://localhost:3012',
  vectorServiceUrl: process.env.VECTOR_SERVICE_URL || 'http://localhost:3014',
  rateLimit: {
    windowMs: Number(process.env.EMAIL_RATE_LIMIT_WINDOW_MS || 60000),
    max: Number(process.env.EMAIL_RATE_LIMIT_MAX || 60),
  },
};
