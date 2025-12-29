// DEPRECATED: This service was for calling external RAG retrieval microservice
// Now integrated directly in chatService.ts hybrid search
// Kept as stub for backwards compatibility

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  source_type?: string;
  file_name?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

class RAGRetrievalService {
  isEnabled(): boolean {
    return false; // Microservice no longer used
  }

  async search(_query: string, _twinId: string, _userId: string, _limit: number): Promise<SearchResult[]> {
    throw new Error('RAG retrieval service disabled - use chatService hybridSearch directly');
  }
}

export default new RAGRetrievalService();
