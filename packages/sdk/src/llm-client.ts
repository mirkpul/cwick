/**
 * Client for LLM Gateway Service
 */
import { BaseClient, BaseClientConfig } from './base-client';
import type {
  GenerateResponseRequest,
  GenerateEmbeddingRequest,
  LLMResponse,
  EmbeddingResponse,
} from '@virtualcoach/shared-types';

export interface LLMClientConfig extends Omit<BaseClientConfig, 'baseURL'> {
  baseURL?: string;
  defaultProvider?: 'openai' | 'anthropic';
}

export class LLMClient extends BaseClient {
  private defaultProvider: 'openai' | 'anthropic';

  constructor(config: LLMClientConfig) {
    super({
      ...config,
      baseURL: config.baseURL || process.env.LLM_GATEWAY_URL || 'http://localhost:3012',
    });
    this.defaultProvider = config.defaultProvider || 'openai';
  }

  async generateResponse(request: GenerateResponseRequest): Promise<LLMResponse> {
    return this.request<LLMResponse>({
      method: 'POST',
      url: '/generate',
      data: { ...request, provider: request.provider || this.defaultProvider },
    });
  }

  async generateEmbedding(request: GenerateEmbeddingRequest): Promise<EmbeddingResponse> {
    return this.request<EmbeddingResponse>({
      method: 'POST',
      url: '/embed',
      data: { ...request, provider: request.provider || this.defaultProvider },
    });
  }

  async generateBatchEmbeddings(texts: string[], provider?: 'openai' | 'anthropic'): Promise<number[][]> {
    const response = await this.request<EmbeddingResponse>({
      method: 'POST',
      url: '/embed/batch',
      data: { text: texts, provider: provider || this.defaultProvider } as GenerateEmbeddingRequest,
    });
    return response.embeddings;
  }
}
