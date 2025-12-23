import { Pool, QueryResultRow } from 'pg';
import { config } from './config';
import { logger } from './logger';

const pool = new Pool({ connectionString: config.databaseUrl });

pool.on('error', (err: Error) => {
  logger.error('Unexpected DB error', { err });
});

export async function query<T extends QueryResultRow = any>(text: string, params: any[] = []): Promise<{ rows: T[] }> {
  const client = await pool.connect();
  try {
    const res = await client.query<T>(text, params);
    return res;
  } finally {
    client.release();
  }
}

export async function shutdown(): Promise<void> {
  await pool.end();
}

export const db = { pool };
