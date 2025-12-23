import { resolvePricing } from './config';

interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export function estimateCost(provider: 'openai' | 'anthropic', model: string, usage?: TokenUsage): number {
  if (!usage) return 0;
  const { prompt: promptPrice, completion: completionPrice } = resolvePricing(provider, model);
  const promptTokens = usage.prompt_tokens || 0;
  const completionTokens = usage.completion_tokens || 0;
  return ((promptTokens * promptPrice) + (completionTokens * completionPrice)) / 1000;
}

export function estimateEmbeddingCost(provider: 'openai' | 'anthropic', model: string, usage?: TokenUsage): number {
  if (!usage) return 0;
  const pricing = resolvePricing(provider, model);
  const pricePerToken = pricing.embedding ?? pricing.prompt;
  const totalTokens = usage.total_tokens || usage.prompt_tokens || 0;
  return (totalTokens * pricePerToken) / 1000;
}
