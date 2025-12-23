-- RAG Benchmark System Tables
-- Migration: 004_rag_benchmark.sql

-- Benchmark datasets (golden + synthetic test sets)
CREATE TABLE IF NOT EXISTS benchmark_datasets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    twin_id UUID NOT NULL REFERENCES digital_twins(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    dataset_type VARCHAR(50) NOT NULL DEFAULT 'golden', -- 'golden', 'synthetic', 'hybrid'
    is_active BOOLEAN DEFAULT true,

    -- Metadata
    total_questions INTEGER DEFAULT 0,
    generation_config JSONB, -- Config used for synthetic generation
    tags JSONB, -- ['faq', 'email', 'complex', 'simple']

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual test questions within datasets
CREATE TABLE IF NOT EXISTS benchmark_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID NOT NULL REFERENCES benchmark_datasets(id) ON DELETE CASCADE,

    -- Question data
    question TEXT NOT NULL,
    expected_answer TEXT, -- Ground truth answer (optional for retrieval-only tests)
    expected_context_ids UUID[], -- Expected KB/email IDs that should be retrieved
    question_type VARCHAR(50) DEFAULT 'simple', -- 'simple', 'complex', 'multi_hop', 'conversational'
    difficulty VARCHAR(20) DEFAULT 'medium', -- 'easy', 'medium', 'hard'

    -- Source information
    source_type VARCHAR(50), -- 'manual', 'synthetic', 'production_log'
    source_kb_id UUID REFERENCES knowledge_base(id) ON DELETE SET NULL,

    -- Metadata
    tags JSONB,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Benchmark runs (test execution instances)
CREATE TABLE IF NOT EXISTS benchmark_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    twin_id UUID NOT NULL REFERENCES digital_twins(id) ON DELETE CASCADE,
    dataset_id UUID REFERENCES benchmark_datasets(id) ON DELETE SET NULL,

    -- Run identification
    name VARCHAR(255),
    description TEXT,
    run_type VARCHAR(50) DEFAULT 'full', -- 'full', 'retrieval_only', 'generation_only', 'ab_test'

    -- Configuration snapshot (frozen at run time)
    rag_config JSONB NOT NULL, -- Complete RAG config used for this run
    comparison_run_id UUID REFERENCES benchmark_runs(id), -- For A/B testing

    -- Run status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
    progress INTEGER DEFAULT 0, -- 0-100 percentage
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,

    -- Aggregate metrics (calculated after completion)
    aggregate_metrics JSONB,
    /*
    {
      "retrieval": {
        "context_precision": 0.85,
        "context_recall": 0.78,
        "mrr": 0.72,
        "ndcg": 0.81,
        "hit_rate": 0.95,
        "avg_retrieved_count": 4.2,
        "avg_latency_ms": 145
      },
      "generation": {
        "faithfulness": 0.92,
        "answer_relevance": 0.88,
        "hallucination_rate": 0.03,
        "semantic_similarity": 0.85,
        "avg_response_length": 256,
        "avg_latency_ms": 1240
      },
      "overall": {
        "success_rate": 0.95,
        "total_questions": 100,
        "avg_total_latency_ms": 1385
      }
    }
    */

    -- Cost tracking
    total_llm_tokens INTEGER DEFAULT 0,
    total_embedding_tokens INTEGER DEFAULT 0,
    estimated_cost_usd DECIMAL(10, 6),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual question results within a run
CREATE TABLE IF NOT EXISTS benchmark_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES benchmark_questions(id) ON DELETE CASCADE,

    -- Input
    input_question TEXT NOT NULL,
    enhanced_query TEXT, -- Query after enhancement

    -- Retrieval results
    retrieved_context_ids UUID[], -- Actual KB/email IDs retrieved
    retrieved_context JSONB, -- Full context with scores
    /*
    [
      {
        "id": "uuid",
        "source": "knowledge_base",
        "title": "...",
        "content": "...",
        "score": 0.85,
        "vector_score": 0.82,
        "bm25_score": 0.78,
        "rerank_score": 0.85
      }
    ]
    */

    -- Generation results
    generated_answer TEXT,
    llm_provider VARCHAR(50),
    llm_model VARCHAR(100),

    -- Timing metrics (milliseconds)
    query_enhancement_ms INTEGER,
    vector_search_ms INTEGER,
    bm25_search_ms INTEGER,
    fusion_ms INTEGER,
    reranking_ms INTEGER,
    generation_ms INTEGER,
    total_latency_ms INTEGER,

    -- Token usage
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    embedding_tokens INTEGER,

    -- Computed metrics (per-question)
    metrics JSONB,
    /*
    {
      "retrieval": {
        "precision": 0.75,      -- % of retrieved that are relevant
        "recall": 1.0,          -- % of expected that were retrieved
        "mrr": 0.5,             -- 1/rank of first relevant
        "ndcg": 0.82,           -- Normalized DCG
        "hit_rate": 1.0         -- Did we get any expected?
      },
      "generation": {
        "faithfulness": 0.95,   -- LLM judge or heuristic
        "answer_relevance": 0.88,
        "semantic_similarity": 0.82  -- To expected answer
      }
    }
    */

    -- Human evaluation (optional)
    human_rating INTEGER CHECK (human_rating >= 1 AND human_rating <= 5),
    human_feedback TEXT,
    evaluated_by UUID REFERENCES users(id),
    evaluated_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- A/B test configurations
CREATE TABLE IF NOT EXISTS benchmark_ab_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    twin_id UUID NOT NULL REFERENCES digital_twins(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Configurations to compare
    config_a JSONB NOT NULL, -- Control configuration
    config_b JSONB NOT NULL, -- Variant configuration
    config_a_name VARCHAR(100) DEFAULT 'Control',
    config_b_name VARCHAR(100) DEFAULT 'Variant',

    -- Associated runs
    run_a_id UUID REFERENCES benchmark_runs(id) ON DELETE SET NULL,
    run_b_id UUID REFERENCES benchmark_runs(id) ON DELETE SET NULL,
    dataset_id UUID REFERENCES benchmark_datasets(id) ON DELETE SET NULL,

    -- Results
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed'
    winner VARCHAR(10), -- 'a', 'b', 'tie', null
    statistical_significance DECIMAL(5, 4), -- p-value
    comparison_results JSONB,
    /*
    {
      "metrics_comparison": {
        "context_precision": { "a": 0.82, "b": 0.88, "diff": 0.06, "pct_change": 7.3 },
        "mrr": { "a": 0.75, "b": 0.79, "diff": 0.04, "pct_change": 5.3 },
        ...
      },
      "recommendation": "Config B shows statistically significant improvement..."
    }
    */

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_benchmark_datasets_twin ON benchmark_datasets(twin_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_datasets_active ON benchmark_datasets(is_active);
CREATE INDEX IF NOT EXISTS idx_benchmark_questions_dataset ON benchmark_questions(dataset_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_questions_active ON benchmark_questions(is_active);
CREATE INDEX IF NOT EXISTS idx_benchmark_runs_twin ON benchmark_runs(twin_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_runs_status ON benchmark_runs(status);
CREATE INDEX IF NOT EXISTS idx_benchmark_runs_dataset ON benchmark_runs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_results_run ON benchmark_results(run_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_results_question ON benchmark_results(question_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_ab_tests_twin ON benchmark_ab_tests(twin_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_ab_tests_status ON benchmark_ab_tests(status);

-- Trigger function for updated_at (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_benchmark_datasets_updated_at ON benchmark_datasets;
CREATE TRIGGER update_benchmark_datasets_updated_at
    BEFORE UPDATE ON benchmark_datasets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_benchmark_questions_updated_at ON benchmark_questions;
CREATE TRIGGER update_benchmark_questions_updated_at
    BEFORE UPDATE ON benchmark_questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_benchmark_runs_updated_at ON benchmark_runs;
CREATE TRIGGER update_benchmark_runs_updated_at
    BEFORE UPDATE ON benchmark_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
