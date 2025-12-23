import { BaseClient, BaseClientConfig } from './base-client';
import type { VectorBatchUpsertRequest, VectorUpsertRequest, VectorSearchRequest } from '@virtualcoach/shared-types';

export interface VectorClientConfig extends Omit<BaseClientConfig, 'baseURL'> {
  baseURL?: string;
}

export class VectorClient extends BaseClient {
  constructor(config: VectorClientConfig) {
    super({
      ...config,
      baseURL: config.baseURL || process.env.VECTOR_SERVICE_URL || 'http://localhost:3014',
    });
  }

  async upsert(request: VectorUpsertRequest): Promise<void> {
    await this.request({ method: 'POST', url: '/vectors/upsert', data: request });
  }

  async batchUpsert(request: VectorBatchUpsertRequest): Promise<void> {
    await this.request({ method: 'POST', url: '/vectors/batch-upsert', data: request });
  }

  async search(request: VectorSearchRequest): Promise<Array<{ id: string; score: number; metadata: any }>> {
    const res = await this.request<{ results: Array<{ id: string; score: number; metadata: any }> }>({
      method: 'POST',
      url: '/vectors/search',
      data: request,
    });
    return res.results;
  }

  async delete(id: string): Promise<void> {
    await this.request({ method: 'DELETE', url: `/vectors/${id}` });
  }
}
