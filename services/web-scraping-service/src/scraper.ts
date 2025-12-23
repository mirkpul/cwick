import fs from 'fs';
import path from 'path';
import puppeteer, { Browser } from 'puppeteer';
import { query } from './db';
import { logger } from './logger';
import { config } from './config';

const SCREENSHOT_DIR = config.dataDir;

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function updateRunStatus(runId: string, status: string, error?: string, pagesProcessed = 0, entriesAdded = 0) {
  await query(
    `UPDATE web_scrape_runs SET status = $1, error = $2, pages_processed = $3, entries_added = $4, completed_at = CASE WHEN $1 IN ('completed','failed') THEN CURRENT_TIMESTAMP ELSE completed_at END
     WHERE id = $5`,
    [status, error || null, pagesProcessed, entriesAdded, runId]
  );
}

async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    executablePath: config.chromiumExecutable,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

export async function runScrape(runId: string, url: string): Promise<void> {
  ensureDir(SCREENSHOT_DIR);
  await updateRunStatus(runId, 'running');

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45_000 });
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (config.screenshotsEnabled) {
      const screenshotPath = path.join(SCREENSHOT_DIR, `${runId}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }

    await updateRunStatus(runId, 'completed', undefined, 1, 0);
    logger.info('Scrape completed', { runId, url, screenshot: config.screenshotsEnabled ? 'saved' : 'disabled' });
  } catch (error: any) {
    logger.error('Scrape failed', { runId, url, error: error?.message });
    await updateRunStatus(runId, 'failed', error?.message || 'unknown error');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export function getScreenshotPath(runId: string): string {
  return path.join(SCREENSHOT_DIR, `${runId}.png`);
}
