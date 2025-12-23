import db from '../config/database';
import logger from '../config/logger';
import config from '../config/appConfig';
import llmService from './llmService';
import queryEnhancementService from './queryEnhancementService';

interface ConversationHistoryEntry {
  sender: string;
  content: string;
  [key: string]: unknown;
}

interface SearchOptions {
  limit?: number;
  provider?: string;
  conversationHistory?: ConversationHistoryEntry[];
  useAdaptive?: boolean;
  threshold?: number;
}

interface SearchResult {
  id: string;
  title: string;
  content: string;
  content_type: string;
  file_name: string;
  chunk_index: number;
  total_chunks: number;
  similarity: number;
  source?: string;
  normalizedScore?: number;
  [key: string]: unknown;
}

class KnowledgeSearchService {
  /**
   * Validate embedding vector before database insertion
   * Ensures the embedding is a valid array of finite numbers with correct dimensions
   */
  validateEmbedding(embedding: number[], expectedDimension = 1536): boolean {
    if (!Array.isArray(embedding)) {
      throw new Error('Embedding must be an array');
    }

    if (embedding.length !== expectedDimension) {
      throw new Error(
        `Embedding dimension mismatch: expected ${expectedDimension}, got ${embedding.length}`
      );
    }

    for (let i = 0; i < embedding.length; i++) {
      const value = embedding[i];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(
          `Invalid embedding value at index ${i}: ${value} (must be a finite number)`
        );
      }
    }

    return true;
  }

  /**
   * Search knowledge base using semantic similarity
   */
  async searchKnowledgeBase(twinId: string, query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      const { limit = 10, provider = 'openai', conversationHistory = [] } = options;

      // Apply query enhancement if enabled (lazy load to avoid circular deps)
      let searchQuery = query;

      if (config.ragOptimization?.queryEnhancement?.enabled) {
        try {
          const enhanced = await queryEnhancementService.enhanceQuery(
            query,
            conversationHistory,
            {
              useContextInjection: config.ragOptimization.queryEnhancement.useConversationContext,
              useHyDE: false,
              useMultiQuery: false,
            }
          );
          searchQuery = enhanced.enhancedQuery || query;

          logger.debug('Query enhanced for search', {
            original: query,
            enhanced: searchQuery,
          });
        } catch (error) {
          logger.warn('Query enhancement failed, using original query', { error: (error as Error).message });
          searchQuery = query;
        }
      }

      // Generate embedding for search query
      const queryEmbedding = await llmService.generateEmbedding(searchQuery, provider);

      // Validate embedding before use
      this.validateEmbedding(queryEmbedding);

      const embeddingVector = `[${queryEmbedding.join(',')}]`;

      // Perform vector similarity search
      const result = await db.query(
        `SELECT
          id,
          title,
          content,
          content_type,
          file_name,
          chunk_index,
          total_chunks,
          created_at,
          'knowledge_base' as source,
          1 - (embedding <=> $2::vector) as similarity
        FROM knowledge_base
        WHERE twin_id = $1 AND embedding IS NOT NULL
        ORDER BY embedding <=> $2::vector
        LIMIT $3`,
        [twinId, embeddingVector, limit]
      );

      return result.rows as SearchResult[];
    } catch (error) {
      logger.error('Knowledge base search error:', error);
      throw error;
    }
  }

  /**
   * Search knowledge base with adaptive filtering to handle embedding score compression
   */
  async searchKnowledgeBaseWithAdaptiveFiltering(
    twinId: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    // Input validation
    if (!twinId || typeof twinId !== 'string' || twinId.trim().length === 0) {
      throw new Error('Invalid twinId: must be a non-empty string');
    }

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Invalid query: must be a non-empty string');
    }

    if (query.length > 10000) {
      throw new Error('Query too long: maximum 10,000 characters');
    }

    try {
      const {
        limit = config.semanticSearch.defaultMaxResults,
        provider = 'openai',
        useAdaptive = config.semanticSearch.useAdaptiveFiltering,
        threshold = config.semanticSearch.defaultThreshold,
      } = options;

      // Validate limit parameter
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new Error('Invalid limit: must be an integer between 1 and 100');
      }

      // Fetch more results for statistical analysis
      const rawResults = await this.searchKnowledgeBase(twinId, query, {
        limit: config.semanticSearch.internalSearchLimit,
        provider,
      });

      if (rawResults.length === 0) {
        logger.info(`No results found for query: "${query}"`);
        return [];
      }

      // Log raw score distribution for debugging
      const scores = rawResults.map(r => r.similarity);
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      logger.info(
        `Search results for "${query.substring(0, 50)}...": ` +
        `count=${rawResults.length}, ` +
        `scores=[${minScore.toFixed(3)}, ${maxScore.toFixed(3)}], ` +
        `avg=${avgScore.toFixed(3)}`
      );

      if (!useAdaptive) {
        // Simple threshold filtering
        const filtered = rawResults.filter(
          r => r.similarity >= threshold
        );
        return filtered.slice(0, limit);
      }

      // Adaptive filtering with multiple strategies
      let filtered = rawResults;

      // Strategy 1: Top score gap filtering
      // Keep only results within X% of the top score
      if (config.semanticSearch.topScoreGapPercent > 0) {
        const topScore = rawResults[0].similarity;
        const minAcceptableScore = topScore - config.semanticSearch.topScoreGapPercent;

        // Ensure we don't go below the absolute minimum threshold
        const effectiveThreshold = Math.max(minAcceptableScore, threshold);

        filtered = filtered.filter(r => r.similarity >= effectiveThreshold);
        logger.info(
          `After top-gap filtering (${config.semanticSearch.topScoreGapPercent}): ` +
          `${filtered.length} results (threshold: ${effectiveThreshold.toFixed(3)})`
        );
      }

      // Strategy 2: Z-score normalization filtering
      // Filter out results that are statistically insignificant
      if (config.semanticSearch.useNormalization && filtered.length >= 5) {
        const normalizedResults = this.normalizeScores(filtered);

        filtered = normalizedResults.filter(
          r => (r.normalizedScore || 0) >= config.semanticSearch.minStdDevAboveMean
        );

        logger.info(
          `After z-score filtering (>${config.semanticSearch.minStdDevAboveMean} std): ` +
          `${filtered.length} results`
        );
      }

      // Strategy 3: Apply base threshold
      filtered = filtered.filter(
        r => r.similarity >= threshold
      );

      logger.info(
        `After threshold filtering (>=${threshold}): ` +
        `${filtered.length} results`
      );

      // Return top N results
      const finalResults = filtered.slice(0, limit);

      return finalResults;
    } catch (error) {
      logger.error('Adaptive search error:', error);
      throw error;
    }
  }

  /**
   * Normalize similarity scores using z-score normalization
   */
  private normalizeScores(results: SearchResult[]): SearchResult[] {
    // Handle edge case: empty array
    if (!results || results.length === 0) {
      return [];
    }

    // Calculate mean
    const scores = results.map(r => r.similarity || 0);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Calculate standard deviation
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    // Apply z-score normalization
    return results.map(result => ({
      ...result,
      normalizedScore: stdDev === 0 ? 0 : (result.similarity - mean) / stdDev
    }));
  }
}

export default new KnowledgeSearchService();
