import { Pool } from 'pg';
import { LLMClient, VectorClient } from '@virtualcoach/sdk';
import type { LLMProvider } from '@virtualcoach/shared-types';
import { logger } from './logger';
import { db } from './db';
import { config } from './config';

interface EmailEmbeddingCandidate {
  emailId: string;
  contentPreview: string;
}

interface EmailContent {
  id: string;
  content: string;
}

/**
 * Email Embedding Service
 *
 * Generates and stores embeddings for email knowledge base entries.
 * Uses the same embedding model as the rest of the RAG pipeline for consistency.
 */
class EmailEmbeddingService {
  private llmClient: LLMClient | null = null;
  private vectorClient: VectorClient | null = null;

  private getLLMClient(): LLMClient {
    if (!this.llmClient) {
      this.llmClient = new LLMClient({
        baseURL: config.llmGatewayUrl,
      });
    }
    return this.llmClient;
  }

  private getVectorClient(): VectorClient {
    if (!this.vectorClient) {
      this.vectorClient = new VectorClient({
        baseURL: config.vectorServiceUrl,
      });
    }
    return this.vectorClient;
  }

  /**
   * Generate and store embeddings for an email
   */
  async generateAndStoreEmbedding(
    pool: Pool,
    emailId: string,
    content: string,
    provider: LLMProvider = 'openai'
  ): Promise<boolean> {
    try {
      // Generate embedding
      const embeddingResponse = await this.getLLMClient().generateEmbedding({
        text: content,
        provider,
      });
      const embedding = embeddingResponse.embeddings[0];

      // Store in database
      await pool.query(
        `UPDATE email_knowledge
         SET embedding = $1, embedding_model = $2
         WHERE id = $3`,
        [JSON.stringify(embedding), provider === 'openai' ? 'text-embedding-3-small' : 'unknown', emailId]
      );

      // Push to vector service if enabled
      await this.getVectorClient().upsert({
        id: emailId,
        vector: embedding,
        metadata: { source: 'email', provider },
        namespace: 'email',
      });

      logger.debug('Email embedding generated and stored', {
        emailId,
        embeddingDimensions: embedding.length,
      });

      return true;
    } catch (error) {
      logger.error('Failed to generate email embedding:', error);
      throw error;
    }
  }

  /**
   * Batch generate embeddings for multiple emails
   */
  async batchGenerateEmbeddings(
    pool: Pool,
    emails: EmailContent[],
    provider: LLMProvider = 'openai'
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    // Generate embeddings in batches
    const batchSize = 100;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const contents = batch.map(e => e.content);

      try {
        // Use batch embedding API
        const embeddings = await this.getLLMClient().generateBatchEmbeddings(contents, provider);

        // Store all embeddings
        for (let j = 0; j < batch.length; j++) {
          try {
            await pool.query(
              `UPDATE email_knowledge
               SET embedding = $1, embedding_model = $2
               WHERE id = $3`,
              [
                JSON.stringify(embeddings[j]),
                provider === 'openai' ? 'text-embedding-3-small' : 'unknown',
                batch[j].id,
              ]
            );
            success++;
          } catch (error) {
            logger.error(`Failed to store embedding for email ${batch[j].id}:`, error);
            failed++;
          }
        }

        logger.info(`Batch ${i / batchSize + 1}: Generated embeddings for ${batch.length} emails`);

        // Small delay to avoid rate limiting
        await this._delay(100);
      } catch (error) {
        logger.error(`Failed to generate embeddings for batch ${i / batchSize + 1}:`, error);
        failed += batch.length;
      }
    }

    logger.info('Email embedding batch complete', { success, failed });

    return { success, failed };
  }

  /**
   * Get emails that need embeddings
   */
  async getEmailsNeedingEmbeddings(pool: Pool, userId: string, limit = 100): Promise<EmailEmbeddingCandidate[]> {
    const result = await pool.query<{ id: string; content: string | null }>(
      `SELECT id, body_text AS content
       FROM email_knowledge
       WHERE user_id = $1
         AND embedding IS NULL
       ORDER BY sent_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(row => ({
      emailId: row.id,
      contentPreview: (row.content || '').substring(0, 200),
    }));
  }

  /**
   * Delay helper
   */
  private _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate embeddings for a user's emails
   */
  async generateEmbeddingsForUser(userId: string, limit = 100): Promise<{ success: number; failed: number }> {
    // Get emails needing embeddings
    const emails = await this.getEmailsNeedingEmbeddings(db.pool, userId, limit);

    if (emails.length === 0) {
      return { success: 0, failed: 0 };
    }

    // Convert to expected format
    const emailsWithContent: EmailContent[] = emails.map(e => ({
      id: e.emailId,
      content: e.contentPreview || ''
    }));

    return this.batchGenerateEmbeddings(db.pool, emailsWithContent);
  }

  /**
   * Get embedding statistics for a user
   */
  async getStats(userId: string): Promise<{
    totalEmails: number;
    withEmbeddings: number;
    withoutEmbeddings: number;
    percentage: number;
  }> {
    const result = await db.pool.query<{ total: string; with_embeddings: string }>(
      `SELECT 
         COUNT(*) as total,
         COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embeddings
       FROM email_knowledge
       WHERE user_id = $1`,
      [userId]
    );

    const total = parseInt(result.rows[0]?.total || '0');
    const withEmbeddings = parseInt(result.rows[0]?.with_embeddings || '0');
    const withoutEmbeddings = total - withEmbeddings;
    const percentage = total > 0 ? (withEmbeddings / total) * 100 : 0;

    return {
      totalEmails: total,
      withEmbeddings,
      withoutEmbeddings,
      percentage
    };
  }

  /**
   * Perform semantic search on email embeddings
   */
  async semanticSearch(
    userId: string,
    query: string,
    options: { limit?: number; threshold?: number; provider?: LLMProvider } = {}
  ): Promise<Array<{
    id: string;
    subject: string;
    content: string;
    similarity: number;
    sentAt: Date;
  }>> {
    const { limit = 10, threshold = 0.7, provider = 'openai' as LLMProvider } = options;

    // Generate query embedding
    const embeddingResponse = await this.getLLMClient().generateEmbedding({
      text: query,
      provider,
    });
    const queryEmbedding = embeddingResponse.embeddings[0];

    // Search using vector similarity
    const result = await db.pool.query<{
      id: string;
      subject: string | null;
      content: string | null;
      sent_at: Date;
      similarity: string;
    }>(
      `SELECT 
         id, subject, body_text AS content, sent_at,
         1 - (embedding <=> $1::vector) as similarity
       FROM email_knowledge
       WHERE user_id = $2
         AND embedding IS NOT NULL
         AND 1 - (embedding <=> $1::vector) >= $3
       ORDER BY embedding <=> $1::vector
       LIMIT $4`,
      [JSON.stringify(queryEmbedding), userId, threshold, limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      subject: row.subject || '',
      content: row.content || '',
      similarity: parseFloat(row.similarity),
      sentAt: row.sent_at
    }));
  }
}

export default new EmailEmbeddingService();
