/**
 * Shared Benchmark Types
 * Consolidated type definitions for benchmark functionality across the frontend
 */

export interface RetrievedContext {
  id?: string;
  content?: string;
  score?: number;
  similarity?: number;
  is_relevant?: boolean;
  relevance_reasoning?: string;
  metadata?: {
    source?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ResultMetrics {
  // Top-level metrics
  context_precision?: number;
  context_recall?: number;
  faithfulness?: number;
  answer_relevancy?: number;

  // Nested metrics (from detailed view)
  retrieval?: {
    context_precision?: number;
    [key: string]: unknown;
  };
  generation?: {
    answer_relevance?: number;
    faithfulness?: number;
    faithfulness_reasoning?: string;
    answer_relevance_reasoning?: string;
    [key: string]: unknown;
  };

  [key: string]: unknown;
}

export interface RunResult {
  id: string;
  // Question fields
  question?: string;
  original_question?: string;
  input_question?: string;

  // Answer fields
  answer?: string;
  expected_answer?: string;
  generated_answer?: string;

  // Score fields
  retrievalScore?: number;
  answerScore?: number;

  // Latency fields
  latency?: number;
  total_latency_ms?: number;

  // Context fields
  expected_context_ids?: string[];
  retrieved_context?: RetrievedContext[] | string | unknown;

  // Metrics
  metrics?: ResultMetrics | string | unknown;

  // Allow additional properties
  [key: string]: unknown;
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
    answer_relevance?: number;
    faithfulness?: number;
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

export interface BenchmarkRun {
  id: string;
  name: string;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  dataset_name?: string;
  run_type?: string;
  created_at: string;
  completed_at?: string;
  rag_config?: string | Record<string, unknown>;
  aggregate_metrics?: AggregateMetrics;
  [key: string]: unknown;
}
