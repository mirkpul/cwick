import { createLogger } from '@virtualcoach/shared-config';

export const logger = createLogger({
  service: 'llm-gateway',
  level: process.env.LOG_LEVEL || 'info',
});
