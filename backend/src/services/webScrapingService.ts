// DEPRECATED: This service was for calling external web-scraping microservice
// Now integrated directly in backend with BullMQ
// Kept as stub for backwards compatibility

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
  async listSources(_kbId: string): Promise<WebSource[]> {
    throw new Error('Web scraping service disabled - functionality integrated in backend');
  }

  async listRuns(_kbId: string, _sourceId: string, _limit: number): Promise<WebScrapeRun[]> {
    throw new Error('Web scraping service disabled - functionality integrated in backend');
  }

  async createSource(_kbId: string, _input: WebSourceInput): Promise<WebSource> {
    throw new Error('Web scraping service disabled - functionality integrated in backend');
  }

  async updateSource(_kbId: string, _sourceId: string, _input: Partial<WebSourceInput>): Promise<WebSource> {
    throw new Error('Web scraping service disabled - functionality integrated in backend');
  }

  async deleteSource(_kbId: string, _sourceId: string): Promise<void> {
    throw new Error('Web scraping service disabled - functionality integrated in backend');
  }

  async triggerScrape(_kbId: string, _llmProvider: string | null, _sourceId: string, _trigger: 'manual' | 'auto'): Promise<{ runId: string }> {
    throw new Error('Web scraping service disabled - functionality integrated in backend');
  }

  async downloadScreenshot(_runId: string): Promise<{ data: Buffer; contentType: string }> {
    throw new Error('Web scraping service disabled - functionality integrated in backend');
  }
}

export default new WebScrapingService();
