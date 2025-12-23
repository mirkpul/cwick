import axios from 'axios';
import { WebScrapingClient } from '@virtualcoach/sdk';
import type { WebSource, WebScrapeRun, CreateWebSourceRequest } from '@virtualcoach/shared-types';
import logger from '../config/logger';

const baseURL = process.env.WEB_SCRAPING_SERVICE_URL || 'http://localhost:3013';
const client = new WebScrapingClient({ baseURL });

export type WebSourceInput = CreateWebSourceRequest;

class WebScrapingService {
  async listSources(twinId: string): Promise<WebSource[]> {
    return client.listSources(twinId);
  }

  async listRuns(twinId: string, sourceId: string, limit: number): Promise<WebScrapeRun[]> {
    return client.listRuns(twinId, sourceId, limit);
  }

  async createSource(twinId: string, input: WebSourceInput): Promise<WebSource> {
    return client.createSource(twinId, {
      twinId,
      name: input.name,
      url: input.url,
      autoRefresh: input.autoRefresh,
      refreshFrequencyHours: input.refreshFrequencyHours,
      cssSelectors: input.cssSelectors,
    });
  }

  async updateSource(twinId: string, sourceId: string, input: Partial<WebSourceInput>): Promise<WebSource> {
    return client.updateSource(twinId, sourceId, {
      twinId,
      name: input.name,
      url: input.url,
      autoRefresh: input.autoRefresh,
      refreshFrequencyHours: input.refreshFrequencyHours,
      cssSelectors: input.cssSelectors,
    });
  }

  async deleteSource(twinId: string, sourceId: string): Promise<void> {
    await client.deleteSource(twinId, sourceId);
  }

  async triggerScrape(twinId: string, _llmProvider: string | null, sourceId: string, trigger: 'manual' | 'auto'): Promise<{ runId: string }> {
    logger.info('Triggering scrape via web-scraping-service', { twinId, sourceId, trigger });
    return client.triggerScrape(twinId, sourceId, { sourceId, force: trigger === 'manual' });
  }

  async downloadScreenshot(runId: string): Promise<{ data: Buffer; contentType: string }> {
    const response = await axios.get(`${baseURL}/runs/${runId}/screenshot`, {
      responseType: 'arraybuffer',
      validateStatus: status => status === 200 || status === 404,
    });

    if (response.status === 404) {
      throw new Error('Screenshot not found');
    }

    return {
      data: Buffer.from(response.data),
      contentType: response.headers['content-type'] || 'image/png',
    };
  }
}

export default new WebScrapingService();
