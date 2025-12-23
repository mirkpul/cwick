import axios from 'axios';
import type { RAGSearchResponse, SearchResult } from '@virtualcoach/shared-types';
import llmService from './llmService';

const baseURL = process.env.RAG_RETRIEVAL_URL || 'http://localhost:3016';

class RAGRetrievalService {
  isEnabled(): boolean {
    return !!process.env.RAG_RETRIEVAL_URL;
  }

  async search(query: string, twinId: string, userId: string, limit: number): Promise<SearchResult[]> {
    const embedding = await llmService.generateEmbedding(query, 'openai');
    const response = await axios.post<RAGSearchResponse>(`${baseURL}/search`, {
      query,
      twinId,
      maxResults: limit,
      queryVector: embedding,
    });

    const payload = response.data as unknown as { data?: RAGSearchResponse; results?: SearchResult[] };
    return payload.data?.results || payload.results || [];
  }
}

export default new RAGRetrievalService();
