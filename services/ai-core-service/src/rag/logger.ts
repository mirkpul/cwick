import { createLogger } from '@virtualcoach/shared-config';

export const logger = createLogger({
  service: 'rag-retrieval-service',
  level: process.env.LOG_LEVEL || 'info',
});
