import { query } from '../config/database';

export interface WebSource {
  id: string;
  kb_id: string;
  name: string;
  url: string;
  auto_refresh: boolean;
  refresh_frequency_hours?: number;
  css_selectors?: string;
  created_at: Date;
  updated_at: Date;
}

export interface WebScrapeRun {
  id: string;
  source_id: string;
  status: string;
  started_at: Date;
  completed_at?: Date;
  error?: string;
}

export interface CreateWebSourceRequest {
  name: string;
  url: string;
  autoRefresh?: boolean;
  refreshFrequencyHours?: number;
  cssSelectors?: string;
}

export type WebSourceInput = CreateWebSourceRequest;

class WebScrapingService {
  async listSources(kbId: string): Promise<WebSource[]> {
    const result = await query<WebSource>(
      `SELECT id, kb_id, name, base_url as url,
              auto_refresh_enabled as auto_refresh,
              schedule_frequency_hours as refresh_frequency_hours,
              config->>'cssSelectors' as css_selectors,
              created_at, updated_at
       FROM web_sources
       WHERE kb_id = $1
       ORDER BY created_at DESC`,
      [kbId]
    );
    return result.rows;
  }

  async listRuns(kbId: string, sourceId: string, limit: number): Promise<WebScrapeRun[]> {
    const result = await query<WebScrapeRun>(
      `SELECT r.id, r.source_id, r.status, r.started_at, r.completed_at, r.error
       FROM web_scrape_runs r
       INNER JOIN web_sources s ON r.source_id = s.id
       WHERE s.kb_id = $1 AND r.source_id = $2
       ORDER BY r.started_at DESC
       LIMIT $3`,
      [kbId, sourceId, limit]
    );
    return result.rows;
  }

  async createSource(kbId: string, input: WebSourceInput): Promise<WebSource> {
    const result = await query<WebSource>(
      `INSERT INTO web_sources (kb_id, name, base_url, auto_refresh_enabled, schedule_frequency_hours, config)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, kb_id, name, base_url as url,
                 auto_refresh_enabled as auto_refresh,
                 schedule_frequency_hours as refresh_frequency_hours,
                 config->>'cssSelectors' as css_selectors,
                 created_at, updated_at`,
      [
        kbId,
        input.name,
        input.url,
        input.autoRefresh || false,
        input.refreshFrequencyHours || 24,
        JSON.stringify({ cssSelectors: input.cssSelectors || '' })
      ]
    );
    return result.rows[0];
  }

  async updateSource(kbId: string, sourceId: string, input: Partial<WebSourceInput>): Promise<WebSource> {
    // First verify the source belongs to this KB
    const checkResult = await query(
      'SELECT id FROM web_sources WHERE id = $1 AND kb_id = $2',
      [sourceId, kbId]
    );

    if (checkResult.rows.length === 0) {
      throw new Error('Web source not found');
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(input.name);
    }
    if (input.url !== undefined) {
      updates.push(`base_url = $${paramCount++}`);
      values.push(input.url);
    }
    if (input.autoRefresh !== undefined) {
      updates.push(`auto_refresh_enabled = $${paramCount++}`);
      values.push(input.autoRefresh);
    }
    if (input.refreshFrequencyHours !== undefined) {
      updates.push(`schedule_frequency_hours = $${paramCount++}`);
      values.push(input.refreshFrequencyHours);
    }
    if (input.cssSelectors !== undefined) {
      updates.push(`config = jsonb_set(config, '{cssSelectors}', $${paramCount++})`);
      values.push(JSON.stringify(input.cssSelectors));
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(sourceId);

    const result = await query<WebSource>(
      `UPDATE web_sources
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, kb_id, name, base_url as url,
                 auto_refresh_enabled as auto_refresh,
                 schedule_frequency_hours as refresh_frequency_hours,
                 config->>'cssSelectors' as css_selectors,
                 created_at, updated_at`,
      values
    );

    return result.rows[0];
  }

  async deleteSource(kbId: string, sourceId: string): Promise<void> {
    const result = await query(
      'DELETE FROM web_sources WHERE id = $1 AND kb_id = $2',
      [sourceId, kbId]
    );

    if (result.rowCount === 0) {
      throw new Error('Web source not found');
    }
  }

  async triggerScrape(kbId: string, _llmProvider: string | null, sourceId: string, trigger: 'manual' | 'auto'): Promise<{ runId: string }> {
    // First verify the source belongs to this KB
    const checkResult = await query(
      'SELECT id FROM web_sources WHERE id = $1 AND kb_id = $2',
      [sourceId, kbId]
    );

    if (checkResult.rows.length === 0) {
      throw new Error('Web source not found');
    }

    // Create a new run
    const result = await query(
      `INSERT INTO web_scrape_runs (source_id, status, trigger_type)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [sourceId, 'pending', trigger]
    );

    // TODO: Trigger actual scraping job via BullMQ or similar
    // For now, just create the run record

    return { runId: result.rows[0].id };
  }

  async downloadScreenshot(_runId: string): Promise<{ data: Buffer; contentType: string }> {
    // TODO: Implement screenshot storage and retrieval
    throw new Error('Screenshot functionality not yet implemented');
  }
}

export default new WebScrapingService();
