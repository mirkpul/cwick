import config from '../config/appConfig';
import logger from '../config/logger';

interface SearchResult {
  id: string;
  score?: number;
  similarity?: number;
  fusedScore?: number;
  content?: string;
  [key: string]: unknown;
}

interface BalanceWeights {
  vector: number;
  bm25: number;
}

/**
 * Ensemble Balancing Service
 *
 * Dynamically adjusts fusion weights based on result analysis to improve hybrid search.
 *
 * Strategies:
 * 1. Score Distribution Analysis - Adjust based on score variance
 * 2. Query Type Detection - Different weights for different query types
 * 3. Result Quality Assessment - Boost better-performing retriever
 *
 * Expected improvements:
 * - Better handling of edge cases (very specific vs broad queries)
 * - Reduced noise from weak retrievers
 * - Improved precision for different query types
 */
class EnsembleBalancingService {
  /**
   * Calculate adaptive weights based on result analysis
   *
   * @param vectorResults - Results from vector search
   * @param bm25Results - Results from BM25 search
   * @param query - Original query
   * @returns Balanced weights for fusion
   */
  calculateAdaptiveWeights(
    vectorResults: SearchResult[],
    bm25Results: SearchResult[],
    query: string
  ): BalanceWeights {
    // Default weights from config
    const defaultVectorWeight = config.ragOptimization.hybridSearch.vectorWeight;
    const defaultBM25Weight = config.ragOptimization.hybridSearch.bm25Weight;

    // If balancing disabled, return defaults
    if (!config.semanticSearch.ensembleBalancing.enabled) {
      return {
        vector: defaultVectorWeight,
        bm25: defaultBM25Weight,
      };
    }

    // Analyze score distributions
    const vectorScoreStats = this._analyzeScoreDistribution(vectorResults);
    const bm25ScoreStats = this._analyzeScoreDistribution(bm25Results);

    // Detect query type
    const queryType = this._detectQueryType(query);

    // Calculate adjustments
    let vectorAdjustment = 0;
    let bm25Adjustment = 0;

    // Adjustment 1: Score quality (confidence in results)
    if (vectorScoreStats.mean > bm25ScoreStats.mean) {
      vectorAdjustment += 0.05;
      bm25Adjustment -= 0.05;
    } else {
      vectorAdjustment -= 0.05;
      bm25Adjustment += 0.05;
    }

    // Adjustment 2: Score variance (consistency)
    if (vectorScoreStats.variance < bm25ScoreStats.variance) {
      vectorAdjustment += 0.03;
      bm25Adjustment -= 0.03;
    } else {
      vectorAdjustment -= 0.03;
      bm25Adjustment += 0.03;
    }

    // Adjustment 3: Query type
    if (queryType === 'keyword') {
      // Prefer BM25 for keyword queries
      bm25Adjustment += 0.1;
      vectorAdjustment -= 0.1;
    } else if (queryType === 'semantic') {
      // Prefer vector for semantic queries
      vectorAdjustment += 0.1;
      bm25Adjustment -= 0.1;
    }

    // Apply adjustments with bounds
    let vectorWeight = defaultVectorWeight + vectorAdjustment;
    let bm25Weight = defaultBM25Weight + bm25Adjustment;

    // Ensure weights stay within reasonable bounds
    vectorWeight = Math.max(0.3, Math.min(0.7, vectorWeight));
    bm25Weight = Math.max(0.3, Math.min(0.7, bm25Weight));

    // Normalize to sum to 1
    const total = vectorWeight + bm25Weight;
    vectorWeight = vectorWeight / total;
    bm25Weight = bm25Weight / total;

    logger.debug('Adaptive weights calculated', {
      queryType,
      vectorStats: vectorScoreStats,
      bm25Stats: bm25ScoreStats,
      adjustments: { vectorAdjustment, bm25Adjustment },
      finalWeights: { vector: vectorWeight, bm25: bm25Weight },
    });

    return {
      vector: vectorWeight,
      bm25: bm25Weight,
    };
  }

  /**
   * Analyze score distribution of search results
   */
  _analyzeScoreDistribution(results: SearchResult[]): {
    mean: number;
    variance: number;
    min: number;
    max: number;
  } {
    if (!results || results.length === 0) {
      return { mean: 0, variance: 0, min: 0, max: 0 };
    }

    const scores = results.map(r => r.score || r.similarity || 0);

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

    const variance =
      scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
      scores.length;

    const min = Math.min(...scores);
    const max = Math.max(...scores);

    return { mean, variance, min, max };
  }

  /**
   * Detect query type based on characteristics
   *
   * Types:
   * - keyword: Specific terms, short queries
   * - semantic: Natural language, longer queries
   * - mixed: In between
   */
  _detectQueryType(query: string): 'keyword' | 'semantic' | 'mixed' {
    const wordCount = query.trim().split(/\s+/).length;
    const hasQuestionWords = /\b(what|how|why|when|where|who|which|can|is|are|do|does)\b/i.test(
      query
    );
    const hasQuotes = /"[^"]+"/.test(query);

    // Keyword indicators
    if (wordCount <= 3 || hasQuotes) {
      return 'keyword';
    }

    // Semantic indicators
    if (wordCount >= 7 && hasQuestionWords) {
      return 'semantic';
    }

    return 'mixed';
  }

  /**
   * Check if ensemble balancing is enabled
   */
  isBalancingEnabled(): boolean {
    return config.semanticSearch.ensembleBalancing.enabled;
  }

  /**
   * Process final ensemble results by applying limits and optional filtering
   *
   * @param results - Search results to process
   * @param maxResults - Maximum number of results to return
   * @param options - Processing options
   * @returns Processed results
   */
  processEnsemble(
    results: SearchResult[],
    maxResults: number,
    options: { skipThreshold?: boolean } = {}
  ): SearchResult[] {
    if (!results || results.length === 0) {
      return [];
    }

    // Apply limit
    const limitedResults = results.slice(0, maxResults);

    logger.debug('Ensemble processing complete', {
      inputCount: results.length,
      outputCount: limitedResults.length,
      maxResults,
      options,
    });

    return limitedResults;
  }
}

export default new EnsembleBalancingService();
