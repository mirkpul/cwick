/**
 * Metric Calculator Service - Computes all RAG evaluation metrics
 *
 * Retrieval Metrics:
 * - Context Precision: Relevant retrieved / Total retrieved
 * - Context Recall: Relevant retrieved / Total relevant
 * - MRR (Mean Reciprocal Rank): Average of 1/rank of first relevant
 * - NDCG: Normalized Discounted Cumulative Gain
 * - Hit Rate: % of queries with at least one relevant result
 *
 * Generation Metrics:
 * - Faithfulness: Answer grounded in retrieved context (LLM judge)
 * - Answer Relevance: Answer addresses the question (LLM judge)
 * - Semantic Similarity: Cosine similarity to expected answer
 */

interface RetrievalResult {
  id?: string;
  score?: number;
  similarity?: number;
  [key: string]: unknown;
}

interface RetrievalMetrics {
  precision: number;
  recall?: number;
  mrr: number;
  ndcg: number;
  hit_rate: number;
  retrieved_count: number;
  expected_count: number;
  llm_context_precision?: number;
}

interface GenerationMetrics {
  faithfulness?: number;
  answer_relevance?: number;
  semantic_similarity?: number;
  context_coverage?: number;
}

interface LengthMetrics {
  chars: number;
  words: number;
  sentences: number;
}

interface BenchmarkResult {
  metrics?: {
    retrieval?: RetrievalMetrics;
    generation?: GenerationMetrics;
  };
  vector_search_ms?: number;
  bm25_search_ms?: number;
  fusion_ms?: number;
  reranking_ms?: number;
  generation_ms?: number;
  total_latency_ms?: number;
  generated_answer?: string;
  [key: string]: unknown;
}

interface AggregateMetrics {
  retrieval: {
    context_precision: number;
    context_recall: number;
    mrr: number;
    ndcg: number;
    hit_rate: number;
    avg_latency_ms: number;
  };
  generation: {
    faithfulness: number;
    answer_relevance: number;
    semantic_similarity: number;
    avg_latency_ms: number;
  };
  overall: {
    success_rate: number;
    total_questions: number;
    successful: number;
    failed: number;
    avg_total_latency_ms: number;
  };
}

interface MetricComparison {
  name: string;
  a: number;
  b: number;
  diff: number;
  pct_change: number;
  better: 'a' | 'b' | 'tie';
}

class MetricCalculatorService {
  // ==================== RETRIEVAL METRICS ====================

  /**
   * Context Precision
   * What fraction of retrieved documents are relevant?
   *
   * Formula: |Retrieved ∩ Relevant| / |Retrieved|
   */
  calculateContextPrecision(retrievedIds: string[], expectedIds: string[]): number {
    if (!retrievedIds || retrievedIds.length === 0) return 0;
    if (!expectedIds || expectedIds.length === 0) return 0;

    const expectedSet = new Set(expectedIds);
    const relevant = retrievedIds.filter(id => expectedSet.has(id));

    return relevant.length / retrievedIds.length;
  }

  /**
   * Mean Reciprocal Rank (MRR)
   * 1/rank of the first relevant document
   */
  calculateMRR(retrievedRanked: RetrievalResult[], expectedIds: string[]): number {
    if (!retrievedRanked || retrievedRanked.length === 0) return 0;
    if (!expectedIds || expectedIds.length === 0) return 0;

    const expectedSet = new Set(expectedIds);

    for (let i = 0; i < retrievedRanked.length; i++) {
      const id = retrievedRanked[i].id || String(retrievedRanked[i]);
      if (id && expectedSet.has(id)) {
        return 1 / (i + 1);
      }
    }

    return 0; // No relevant found
  }

  /**
   * Normalized Discounted Cumulative Gain (NDCG@k)
   * Measures ranking quality with position-based discounting
   *
   * DCG@k = Σ(rel_i / log2(i+1)) for i=1 to k
   * NDCG@k = DCG@k / IDCG@k (ideal DCG)
   */
  calculateNDCG(retrievedRanked: RetrievalResult[], expectedIds: string[], k = 10): number {
    if (!retrievedRanked || retrievedRanked.length === 0) return 0;
    if (!expectedIds || expectedIds.length === 0) return 0;

    const expectedSet = new Set(expectedIds);
    const results = retrievedRanked.slice(0, k);

    // Calculate DCG
    let dcg = 0;
    for (let i = 0; i < results.length; i++) {
      const id = results[i].id || String(results[i]);
      const relevance = id && expectedSet.has(id) ? 1 : 0;
      dcg += relevance / Math.log2(i + 2); // +2 because log2(1)=0
    }

    // Calculate IDCG (all relevant at top)
    const idealResults = Math.min(expectedIds.length, k);
    let idcg = 0;
    for (let i = 0; i < idealResults; i++) {
      idcg += 1 / Math.log2(i + 2);
    }

    return idcg > 0 ? dcg / idcg : 0;
  }

  /**
   * Hit Rate
   * Did we get at least one relevant document?
   */
  calculateHitRate(retrievedIds: string[], expectedIds: string[]): number {
    if (!retrievedIds || retrievedIds.length === 0) return 0;
    if (!expectedIds || expectedIds.length === 0) return 0;

    const expectedSet = new Set(expectedIds);
    return retrievedIds.some(id => expectedSet.has(id)) ? 1 : 0;
  }

  /**
   * Context Recall
   * What fraction of relevant documents were retrieved?
   *
   * Formula: |Retrieved ∩ Relevant| / |Relevant|
   */
  calculateContextRecall(retrievedIds: string[], expectedIds: string[]): number {
    if (!expectedIds || expectedIds.length === 0) return 0;
    if (!retrievedIds || retrievedIds.length === 0) return 0;

    const expectedSet = new Set(expectedIds);
    const relevant = retrievedIds.filter(id => expectedSet.has(id));

    return relevant.length / expectedIds.length;
  }

  /**
   * Calculate all retrieval metrics at once
   */
  calculateRetrievalMetrics(retrieved: RetrievalResult[], expectedIds: string[]): RetrievalMetrics {
    const retrievedIds = retrieved.map(r => r.id || String(r));

    return {
      precision: this.calculateContextPrecision(retrievedIds, expectedIds),
      recall: this.calculateContextRecall(retrievedIds, expectedIds),
      mrr: this.calculateMRR(retrieved, expectedIds),
      ndcg: this.calculateNDCG(retrieved, expectedIds, 10),
      hit_rate: this.calculateHitRate(retrievedIds, expectedIds),
      retrieved_count: retrievedIds.length,
      expected_count: expectedIds?.length || 0,
    };
  }

  // ==================== GENERATION METRICS ====================

  /**
   * Calculate semantic similarity between two texts using embeddings
   * This is a simplified version - in production, use actual embeddings
   */
  calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;

    // Simple Jaccard similarity on words as fallback
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));

    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;

    return union > 0 ? intersection / union : 0;
  }

  /**
   * Calculate semantic similarity using embeddings
   * Requires embedding vectors to be provided
   */
  calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (!embedding1 || !embedding2) return 0;
    if (embedding1.length !== embedding2.length) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  /**
   * Simple heuristic for checking if answer mentions context
   * This is a basic check - LLM judge provides better evaluation
   */
  calculateContextCoverage(answer: string, context: Array<{ content?: string } | string>): number {
    if (!answer || !context || context.length === 0) return 0;

    const answerWords = new Set(
      answer.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );

    let totalContextWords = 0;
    let matchedWords = 0;

    for (const chunk of context) {
      const content = typeof chunk === 'string' ? chunk : chunk.content || '';
      const contextWords = content.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      totalContextWords += contextWords.length;
      matchedWords += contextWords.filter(w => answerWords.has(w)).length;
    }

    return totalContextWords > 0 ? matchedWords / totalContextWords : 0;
  }

  /**
   * Calculate answer length metrics
   */
  calculateLengthMetrics(answer: string): LengthMetrics {
    if (!answer) return { chars: 0, words: 0, sentences: 0 };

    const words = answer.split(/\s+/).filter(w => w.length > 0);
    const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 0);

    return {
      chars: answer.length,
      words: words.length,
      sentences: sentences.length,
    };
  }

  // ==================== AGGREGATE CALCULATIONS ====================

  /**
   * Aggregate metrics across multiple results
   */
  calculateAggregateMetrics(results: BenchmarkResult[]): AggregateMetrics {
    if (!results || results.length === 0) {
      return this._getEmptyAggregateMetrics();
    }

    const retrieval = {
      precision: [] as number[],
      recall: [] as number[],
      mrr: [] as number[],
      ndcg: [] as number[],
      hit_rate: [] as number[],
      latency_ms: [] as number[],
    };

    const generation = {
      faithfulness: [] as number[],
      answer_relevance: [] as number[],
      semantic_similarity: [] as number[],
      latency_ms: [] as number[],
    };

    const overall = {
      total_latency_ms: [] as number[],
      success: 0,
      failed: 0,
    };

    for (const result of results) {
      const metrics = result.metrics || {};

      // Retrieval metrics
      if (metrics.retrieval) {
        if (metrics.retrieval.precision !== undefined) retrieval.precision.push(metrics.retrieval.precision);
        if (metrics.retrieval.recall !== undefined) retrieval.recall.push(metrics.retrieval.recall);
        if (metrics.retrieval.mrr !== undefined) retrieval.mrr.push(metrics.retrieval.mrr);
        if (metrics.retrieval.ndcg !== undefined) retrieval.ndcg.push(metrics.retrieval.ndcg);
        if (metrics.retrieval.hit_rate !== undefined) retrieval.hit_rate.push(metrics.retrieval.hit_rate);
      }

      // Generation metrics
      if (metrics.generation) {
        if (metrics.generation.faithfulness !== undefined) generation.faithfulness.push(metrics.generation.faithfulness);
        if (metrics.generation.answer_relevance !== undefined) generation.answer_relevance.push(metrics.generation.answer_relevance);
        if (metrics.generation.semantic_similarity !== undefined) generation.semantic_similarity.push(metrics.generation.semantic_similarity);
      }

      // Timing metrics
      if (result.vector_search_ms !== undefined) {
        const retrievalLatency = (result.vector_search_ms || 0) +
          (result.bm25_search_ms || 0) +
          (result.fusion_ms || 0) +
          (result.reranking_ms || 0);
        retrieval.latency_ms.push(retrievalLatency);
      }

      if (result.generation_ms !== undefined) {
        generation.latency_ms.push(result.generation_ms);
      }

      if (result.total_latency_ms !== undefined) {
        overall.total_latency_ms.push(result.total_latency_ms);
      }

      // Success tracking
      if (result.generated_answer) {
        overall.success++;
      } else {
        overall.failed++;
      }
    }

    return {
      retrieval: {
        context_precision: this._average(retrieval.precision),
        context_recall: this._average(retrieval.recall),
        mrr: this._average(retrieval.mrr),
        ndcg: this._average(retrieval.ndcg),
        hit_rate: this._average(retrieval.hit_rate),
        avg_latency_ms: Math.round(this._average(retrieval.latency_ms)),
      },
      generation: {
        faithfulness: this._average(generation.faithfulness),
        answer_relevance: this._average(generation.answer_relevance),
        semantic_similarity: this._average(generation.semantic_similarity),
        avg_latency_ms: Math.round(this._average(generation.latency_ms)),
      },
      overall: {
        success_rate: results.length > 0 ? overall.success / results.length : 0,
        total_questions: results.length,
        successful: overall.success,
        failed: overall.failed,
        avg_total_latency_ms: Math.round(this._average(overall.total_latency_ms)),
      },
    };
  }

  /**
   * Compare metrics between two runs
   */
  compareMetrics(metricsA: AggregateMetrics, metricsB: AggregateMetrics): Record<string, MetricComparison> {
    const comparison: Record<string, MetricComparison> = {};

    const metricsToCompare = [
      { path: 'retrieval.context_precision', name: 'Context Precision' },
      { path: 'retrieval.mrr', name: 'MRR' },
      { path: 'retrieval.ndcg', name: 'NDCG' },
      { path: 'retrieval.hit_rate', name: 'Hit Rate' },
      { path: 'retrieval.avg_latency_ms', name: 'Retrieval Latency' },
      { path: 'generation.faithfulness', name: 'Faithfulness' },
      { path: 'generation.answer_relevance', name: 'Answer Relevance' },
      { path: 'generation.avg_latency_ms', name: 'Generation Latency' },
      { path: 'overall.success_rate', name: 'Success Rate' },
      { path: 'overall.avg_total_latency_ms', name: 'Total Latency' },
    ];

    for (const metric of metricsToCompare) {
      const valueA = this._getNestedValue(metricsA as unknown as Record<string, unknown>, metric.path);
      const valueB = this._getNestedValue(metricsB as unknown as Record<string, unknown>, metric.path);

      if (valueA !== undefined && valueB !== undefined) {
        const diff = valueB - valueA;
        const pctChange = valueA !== 0 ? ((valueB - valueA) / valueA) * 100 : 0;

        comparison[metric.path] = {
          name: metric.name,
          a: valueA,
          b: valueB,
          diff: Math.round(diff * 10000) / 10000,
          pct_change: Math.round(pctChange * 100) / 100,
          better: this._determineBetter(metric.path, diff),
        };
      }
    }

    return comparison;
  }

  // ==================== HELPER METHODS ====================

  private _average(arr: number[]): number {
    if (!arr || arr.length === 0) return 0;
    const valid = arr.filter(v => v !== null && v !== undefined && !isNaN(v));
    if (valid.length === 0) return 0;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }

  private _getNestedValue(obj: Record<string, unknown>, path: string): number | undefined {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj) as number | undefined;
  }

  private _determineBetter(metricPath: string, diff: number): 'a' | 'b' | 'tie' {
    // For latency metrics, lower is better
    if (metricPath.includes('latency')) {
      return diff < 0 ? 'b' : diff > 0 ? 'a' : 'tie';
    }
    // For all other metrics, higher is better
    return diff > 0 ? 'b' : diff < 0 ? 'a' : 'tie';
  }

  private _getEmptyAggregateMetrics(): AggregateMetrics {
    return {
      retrieval: {
        context_precision: 0,
        context_recall: 0,
        mrr: 0,
        ndcg: 0,
        hit_rate: 0,
        avg_latency_ms: 0,
      },
      generation: {
        faithfulness: 0,
        answer_relevance: 0,
        semantic_similarity: 0,
        avg_latency_ms: 0,
      },
      overall: {
        success_rate: 0,
        total_questions: 0,
        successful: 0,
        failed: 0,
        avg_total_latency_ms: 0,
      },
    };
  }
}

export default new MetricCalculatorService();
