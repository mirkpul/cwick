import dotenv from 'dotenv';

dotenv.config();

type PricingMap = Record<string, { prompt: number; completion: number; embedding?: number }>;

const defaultPricing: Record<'openai' | 'anthropic', PricingMap> = {
  openai: {
    'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
    'gpt-4o': { prompt: 0.005, completion: 0.015 },
    'gpt-4.1': { prompt: 0.005, completion: 0.015 },
    'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
    'text-embedding-3-small': { prompt: 0.00002, completion: 0.00002, embedding: 0.00002 },
    'text-embedding-3-large': { prompt: 0.00013, completion: 0.00013, embedding: 0.00013 },
  },
  anthropic: {
    'claude-3-5-sonnet-20241022': { prompt: 0.003, completion: 0.015 },
    'claude-3-sonnet-20240229': { prompt: 0.003, completion: 0.015 },
    'claude-3-haiku-20240307': { prompt: 0.00025, completion: 0.00125 },
  },
};

const envNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: envNumber(process.env.PORT, 3012),
  openaiApiKey: process.env.OPENAI_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  defaultProvider: (process.env.LLM_DEFAULT_PROVIDER as 'openai' | 'anthropic') || 'openai',
  defaultModel: process.env.LLM_DEFAULT_MODEL || 'gpt-4o-mini',
  defaultEmbeddingModel: process.env.LLM_DEFAULT_EMBEDDING_MODEL || 'text-embedding-3-small',
  fallbackModels: {
    openai: process.env.LLM_FALLBACK_MODEL_OPENAI || 'gpt-3.5-turbo',
    anthropic: process.env.LLM_FALLBACK_MODEL_ANTHROPIC || 'claude-3-haiku-20240307',
  },
  rateLimit: {
    windowMs: envNumber(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: envNumber(process.env.RATE_LIMIT_MAX, 60),
  },
  pricing: defaultPricing,
  databaseUrl: process.env.DATABASE_URL,
};

export function resolvePricing(provider: 'openai' | 'anthropic', model: string): { prompt: number; completion: number; embedding?: number } {
  const normalized = model.toLowerCase();
  const providerPricing = config.pricing[provider];

  // Exact match
  const exact = providerPricing[model];
  if (exact) return exact;

  // Fuzzy match on prefix (useful for gpt-4o-mini-... variants)
  const fuzzy = Object.entries(providerPricing).find(([key]) => normalized.startsWith(key.toLowerCase()));
  if (fuzzy) return fuzzy[1];

  // Fallback: cheapest known model per provider
  const fallback = provider === 'openai'
    ? providerPricing['gpt-3.5-turbo']
    : providerPricing['claude-3-haiku-20240307'];
  return fallback || { prompt: 0, completion: 0 };
}
