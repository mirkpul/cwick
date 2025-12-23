import { Pool } from 'pg';
import { logger } from './logger';

export interface UsageRecord {
  provider: 'openai' | 'anthropic';
  model: string;
  operation: 'chat' | 'embedding' | 'vision' | 'streaming';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  userId?: string;
  twinId?: string;
  metadata?: Record<string, unknown>;
}

export class UsageTracker {
  private pool: Pool | null;

  constructor(databaseUrl?: string) {
    this.pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
  }

  async track(record: UsageRecord): Promise<void> {
    if (!this.pool) {
      logger.debug('Usage tracking skipped (no database configured)', record);
      return;
    }

    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO llm_usage (
          user_id,
          twin_id,
          provider,
          model,
          operation,
          prompt_tokens,
          completion_tokens,
          total_tokens,
          cost_usd,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`
          , [
            record.userId || null,
            record.twinId || null,
            record.provider,
            record.model,
            record.operation,
            record.promptTokens,
            record.completionTokens,
            record.totalTokens,
            record.costUsd,
            JSON.stringify(record.metadata || {}),
          ]
      );
    } catch (error) {
      logger.error('Failed to persist usage record', { error, record });
    } finally {
      client.release();
    }
  }

  async shutdown(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }
}
