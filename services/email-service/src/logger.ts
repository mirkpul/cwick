import { createLogger } from '@virtualcoach/shared-config';

export const logger = createLogger({
  service: 'email-service',
  level: process.env.LOG_LEVEL || 'info',
});
