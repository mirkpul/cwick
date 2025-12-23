import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3013),
  databaseUrl: process.env.DATABASE_URL,
  dataDir: process.env.SCRAPER_DATA_DIR || `${process.cwd()}/data/web-scraping`,
  chromiumExecutable: process.env.PUPPETEER_EXECUTABLE_PATH,
  redisUrl: process.env.WEB_SCRAPING_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379',
  concurrency: Number(process.env.SCRAPER_CONCURRENCY || 2),
  schedulerIntervalMs: Number(process.env.SCRAPER_SCHEDULER_INTERVAL_MS || 300000),
  role: (process.env.WEB_SCRAPING_ROLE as 'api' | 'worker' | 'api-worker') || 'api-worker',
  screenshotsEnabled: (process.env.SCRAPER_ENABLE_SCREENSHOTS || 'false').toLowerCase() === 'true',
};
