// DEPRECATED: This service was for calling external vector store microservice
// Now integrated directly in database with pgvector
// Kept as stub for backwards compatibility

export interface VectorUpsertRequest {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
  namespace?: string;
}

export interface VectorSearchRequest {
  vector: number[];
  topK?: number;
  limit?: number; // Alias for topK
  namespace?: string;
  filter?: Record<string, unknown>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

class VectorStoreService {
  isEnabled(): boolean {
    return false; // Microservice no longer used
  }

  async upsertEmbedding(_payload: Omit<VectorUpsertRequest, 'namespace'> & { namespace?: string }): Promise<void> {
    throw new Error('Vector store service disabled - vectors stored in PostgreSQL directly');
  }

  async search(_request: VectorSearchRequest): Promise<VectorSearchResult[]> {
    throw new Error('Vector store service disabled - use PostgreSQL pgvector directly');
  }
}

export default new VectorStoreService();
