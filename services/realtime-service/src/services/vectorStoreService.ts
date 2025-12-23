import { VectorClient } from '@virtualcoach/sdk';
import type { VectorUpsertRequest, VectorSearchRequest, VectorSearchResult } from '@virtualcoach/shared-types';
import logger from '../config/logger';

const VECTOR_SERVICE_URL = process.env.VECTOR_SERVICE_URL || 'http://localhost:3014';
const VECTOR_NAMESPACE = process.env.VECTOR_NAMESPACE || 'default';

const client = new VectorClient({ baseURL: VECTOR_SERVICE_URL });

class VectorStoreService {
  isEnabled(): boolean {
    return !!process.env.VECTOR_SERVICE_URL;
  }

  async upsertEmbedding(payload: Omit<VectorUpsertRequest, 'namespace'> & { namespace?: string }): Promise<void> {
    if (!this.isEnabled()) return;
    try {
      await client.upsert({ ...payload, namespace: payload.namespace || VECTOR_NAMESPACE });
    } catch (error) {
      logger.error('Vector upsert failed', { error });
    }
  }

  async search(request: VectorSearchRequest): Promise<VectorSearchResult[]> {
    if (!this.isEnabled()) return [];
    return client.search({ ...request, namespace: request.namespace || VECTOR_NAMESPACE });
  }
}

export default new VectorStoreService();
