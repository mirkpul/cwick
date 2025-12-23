import { query } from './db';
import { logger } from './logger';
import { scrapeQueue } from './queue';
import { config } from './config';

const MIN_INTERVAL = 60_000;

function computeNextRun(hours: number): Date {
  const safeHours = Math.max(1, Math.min(168, hours || 24));
  return new Date(Date.now() + safeHours * 60 * 60 * 1000);
}

export async function enqueueDueSources(): Promise<void> {
  const result = await query<{
    id: string;
    base_url: string;
    schedule_frequency_hours: number;
  }>(
    `SELECT id, base_url, schedule_frequency_hours
     FROM web_sources
     WHERE auto_refresh_enabled = true
       AND is_active = true
       AND (next_run_at IS NULL OR next_run_at <= NOW())
     LIMIT 50`
  );

  for (const row of result.rows) {
    const nextRun = computeNextRun(row.schedule_frequency_hours || 24);
    const run = await query<{ id: string }>(
      `INSERT INTO web_scrape_runs (source_id, status, trigger_type, pages_processed, entries_added)
       VALUES ($1, $2, $3, 0, 0) RETURNING id`,
      [row.id, 'pending', 'auto']
    );
    await scrapeQueue.add('scrape', { runId: run.rows[0].id, url: row.base_url });
    await query(
      `UPDATE web_sources SET next_run_at = $1 WHERE id = $2`,
      [nextRun.toISOString(), row.id]
    );
  }

  if (result.rows.length > 0) {
    logger.info('Enqueued due web sources', { count: result.rows.length });
  }
}

export function startScheduler(): NodeJS.Timeout {
  const interval = Math.max(MIN_INTERVAL, config.schedulerIntervalMs);
  logger.info('Starting web scraping scheduler', { intervalMs: interval });
  const handle = setInterval(() => {
    enqueueDueSources().catch(err => logger.error('Scheduler run failed', { error: err?.message }));
  }, interval);
  return handle;
}
