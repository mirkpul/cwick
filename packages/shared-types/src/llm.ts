/**
 * LLM provider types and interfaces
 */

export type LLMProvider = 'openai' | 'anthropic';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequestOptions {
  provider: LLMProvider;
  model: string;
  messages: LLMMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finish_reason?: string;
}

export interface EmbeddingRequest {
  text: string | string[];
  model?: string;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface LLMUsageTracking {
  id: string;
  user_id?: string;
  twin_id?: string;
  provider: LLMProvider;
  model: string;
  operation: 'chat' | 'embedding' | 'vision' | 'streaming';
  prompt_tokens: number;
  completion_tokens?: number;
  total_tokens: number;
  cost_usd: number;
  created_at: Date;
}
