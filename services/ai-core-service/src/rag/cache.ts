import type { RAGSearchResponse } from '@virtualcoach/shared-types';
import { config } from './config';

const cache = new Map<string, { expiresAt: number; value: RAGSearchResponse }>();

function cleanup(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

export function getCached(key: string): RAGSearchResponse | null {
  cleanup();
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function setCached(key: string, value: RAGSearchResponse): void {
  cleanup();
  const expiresAt = Date.now() + config.cache.ttlMs;
  cache.set(key, { expiresAt, value });

  if (cache.size > config.cache.maxEntries) {
    const firstKey = cache.keys().next().value as string | undefined;
    if (firstKey) {
      cache.delete(firstKey);
    }
  }
}
