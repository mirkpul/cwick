/**
 * Shared Benchmark Types for Backend
 */

export interface DatasetStats {
  total_questions: number;
  simple_count: number;
  complex_count: number;
  multi_hop_count: number;
  easy_count: number;
  medium_count: number;
  hard_count: number;
  with_expected_answer?: number;
  with_expected_context?: number;
}

export interface QuestionResult {
  input_question: string;
  original_question?: string;
  expected_answer?: string;
  generated_answer?: string;
  total_latency_ms?: number;
  expected_context_ids?: string[];
  metrics?: Record<string, unknown>;
  retrieved_context?: Record<string, unknown>[];
}

export interface Comparison {
  runA: {
    id: string;
    name: string;
    metrics: Record<string, unknown>;
  };
  runB: {
    id: string;
    name: string;
    metrics: Record<string, unknown>;
  };
  comparison: Record<string, {
    pct_change?: number;
    abs_change?: number;
    better?: boolean;
  }>;
  summary: {
    improvements: number;
    regressions: number;
    no_change: number;
  };
}

export interface AggregateMetrics {
  retrieval?: {
    context_precision?: number;
    context_recall?: number;
    mrr?: number;
    ndcg?: number;
    hit_rate?: number;
    avg_latency_ms?: number;
    [key: string]: unknown;
  };
  generation?: {
    faithfulness?: number;
    answer_relevance?: number;
    semantic_similarity?: number;
    avg_latency_ms?: number;
    [key: string]: unknown;
  };
  overall?: {
    success_rate?: number;
    total_questions?: number;
    successful?: number;
    avg_total_latency_ms?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
