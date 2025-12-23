import { createLogger } from '@virtualcoach/shared-config';

export const logger = createLogger({
  service: 'web-scraping-service',
  level: process.env.LOG_LEVEL || 'info',
});
