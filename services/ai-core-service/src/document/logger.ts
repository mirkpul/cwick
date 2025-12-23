import { createLogger } from '@virtualcoach/shared-config';

export const logger = createLogger({
  service: 'document-processing-service',
  level: process.env.LOG_LEVEL || 'info',
});
