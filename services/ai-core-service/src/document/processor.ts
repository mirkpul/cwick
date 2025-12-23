import { LLMClient, VectorClient } from '@virtualcoach/sdk';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { config } from './config';
import { logger } from './logger';
import { query } from './db';

const llmClient = new LLMClient({ baseURL: config.llmGatewayUrl, defaultProvider: 'openai' });
const vectorClient = new VectorClient({ baseURL: config.vectorServiceUrl });

function chunkText(text: string, size: number, overlap: number): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  let start = 0;
  const safeOverlap = Math.max(0, Math.min(size - 1, overlap));
  while (start < text.length) {
    const end = Math.min(text.length, start + size);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = end - safeOverlap;
  }
  return chunks;
}

export async function extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'text/plain' || mimeType === 'text/markdown' || mimeType === 'text/csv') {
    return buffer.toString('utf-8');
  }

  if (mimeType === 'application/pdf') {
    const result = await pdfParse(buffer);
    return result.text || '';
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }

  throw new Error('Unsupported file type');
}

export async function processTextDocument(params: {
  twinId: string;
  fileName: string;
  content: string;
  contentType: string;
}): Promise<{ entriesCreated: number; chunks: number }> {
  const { twinId, fileName, content, contentType } = params;
  const chunks = chunkText(content, config.chunkSize, config.chunkOverlap);

  if (chunks.length === 0) {
    return { entriesCreated: 0, chunks: 0 };
  }

  const embeddings = await llmClient.generateBatchEmbeddings(chunks, 'openai');

  let parentEntryId: string | null = null;
  let entriesCreated = 0;

  for (let i = 0; i < chunks.length; i++) {
    const embedding = embeddings[i];
    const embeddingVector = `[${embedding.join(',')}]`;

    const insertResult: { rows: Array<{ id: string }> } = await query<{ id: string }>(
      `INSERT INTO knowledge_base (
        twin_id,
        title,
        content,
        content_type,
        file_name,
        chunk_index,
        total_chunks,
        parent_entry_id,
        embedding
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id`,
      [
        twinId,
        `${fileName} - Part ${i + 1}`,
        chunks[i],
        contentType,
        fileName,
        i,
        chunks.length,
        i === 0 ? null : parentEntryId,
        embeddingVector,
      ]
    );

    if (i === 0) {
      parentEntryId = insertResult.rows[0].id;
    }

    entriesCreated += 1;

    try {
      await vectorClient.upsert({
        id: insertResult.rows[0].id,
        vector: embedding,
        namespace: 'knowledge_base',
        metadata: { twinId, source: 'knowledge_base', fileName, chunkIndex: i, totalChunks: chunks.length },
      });
    } catch (error) {
      logger.error('Vector upsert failed', { error });
    }
  }

  logger.info('Processed document', { fileName, entriesCreated, chunks: chunks.length });
  return { entriesCreated, chunks: chunks.length };
}
