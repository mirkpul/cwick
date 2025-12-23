import { BaseClient, BaseClientConfig } from './base-client';
import type {
  ApiResponse,
  CreateWebSourceRequest,
  TriggerScrapeRequest,
  WebSource,
  WebScrapeRun,
} from '@virtualcoach/shared-types';

export interface WebScrapingClientConfig extends Omit<BaseClientConfig, 'baseURL'> {
  baseURL?: string;
}

export class WebScrapingClient extends BaseClient {
  constructor(config: WebScrapingClientConfig) {
    super({
      ...config,
      baseURL: config.baseURL || process.env.WEB_SCRAPING_SERVICE_URL || 'http://localhost:3013',
    });
  }

  async listSources(twinId: string): Promise<WebSource[]> {
    return this.request<WebSource[]>({ method: 'GET', url: '/sources', params: { twinId } });
  }

  async listRuns(twinId: string, sourceId: string, limit = 20): Promise<WebScrapeRun[]> {
    return this.request<WebScrapeRun[]>({
      method: 'GET',
      url: `/sources/${sourceId}/runs`,
      params: { twinId, limit },
    });
  }

  async createSource(twinId: string, payload: CreateWebSourceRequest): Promise<WebSource> {
    return this.request<WebSource>({
      method: 'POST',
      url: '/sources',
      data: { ...payload, twinId },
    });
  }

  async updateSource(twinId: string, sourceId: string, payload: Partial<CreateWebSourceRequest>): Promise<WebSource> {
    return this.request<WebSource>({
      method: 'PUT',
      url: `/sources/${sourceId}`,
      data: { ...payload, twinId },
    });
  }

  async deleteSource(twinId: string, sourceId: string): Promise<ApiResponse> {
    return this.request<ApiResponse>({ method: 'DELETE', url: `/sources/${sourceId}`, params: { twinId } });
  }

  async triggerScrape(twinId: string, sourceId: string, payload: TriggerScrapeRequest): Promise<{ runId: string }> {
    return this.request<{ runId: string }>({
      method: 'POST',
      url: `/sources/${sourceId}/scrape`,
      data: { ...payload, twinId },
    });
  }
}
