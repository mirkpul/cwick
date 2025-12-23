import { createLogger } from '@virtualcoach/shared-config';

export const logger = createLogger({
  service: 'ai-core-service',
  level: process.env.LOG_LEVEL || 'info',
});
