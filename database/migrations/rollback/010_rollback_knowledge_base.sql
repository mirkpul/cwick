-- Rollback 010: Revert knowledge_bases → digital_twins
-- This rollback script reverts the transformation from migration 010
-- WARNING: New columns (description, is_public, share_url) will be DROPPED and data LOST

-- Step 1: Drop new Knowledge Base specific columns
ALTER TABLE knowledge_bases
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS is_public,
  DROP COLUMN IF EXISTS share_url;

-- Step 2: Add back Digital Twin specific columns
ALTER TABLE knowledge_bases
  ADD COLUMN IF NOT EXISTS profession VARCHAR(255),
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS personality_traits JSONB,
  ADD COLUMN IF NOT EXISTS communication_style VARCHAR(100),
  ADD COLUMN IF NOT EXISTS capabilities TEXT[],
  ADD COLUMN IF NOT EXISTS services JSONB,
  ADD COLUMN IF NOT EXISTS pricing_info JSONB,
  ADD COLUMN IF NOT EXISTS availability_schedule JSONB,
  ADD COLUMN IF NOT EXISTS handover_threshold DECIMAL(3,2) DEFAULT 0.70;

-- Step 3: Rename the main table back
ALTER TABLE knowledge_bases RENAME TO digital_twins;

-- Step 4: Update foreign key columns in related tables
-- Update knowledge_base table
ALTER TABLE knowledge_base RENAME COLUMN kb_id TO twin_id;

-- Update conversations table
ALTER TABLE conversations RENAME COLUMN kb_id TO twin_id;

-- Update analytics_events table
ALTER TABLE analytics_events RENAME COLUMN kb_id TO twin_id;

-- Update benchmark tables
ALTER TABLE IF EXISTS benchmark_datasets RENAME COLUMN kb_id TO twin_id;
ALTER TABLE IF EXISTS benchmark_runs RENAME COLUMN kb_id TO twin_id;
ALTER TABLE IF EXISTS benchmark_ab_tests RENAME COLUMN kb_id TO twin_id;

-- Update web scraping table
ALTER TABLE IF EXISTS web_sources RENAME COLUMN kb_id TO twin_id;

-- Update LLM usage tracking table
ALTER TABLE IF EXISTS llm_usage RENAME COLUMN kb_id TO twin_id;

-- Update document processing jobs table
ALTER TABLE IF EXISTS document_processing_jobs RENAME COLUMN kb_id TO twin_id;

-- Step 5: Drop new indexes
DROP INDEX IF EXISTS idx_knowledge_bases_user_id;
DROP INDEX IF EXISTS idx_knowledge_bases_is_public;
DROP INDEX IF EXISTS idx_knowledge_bases_share_url;
DROP INDEX IF EXISTS idx_knowledge_bases_semantic_config;
DROP INDEX IF EXISTS idx_knowledge_bases_rag_config;

-- Drop indexes in related tables
DROP INDEX IF EXISTS idx_knowledge_base_kb_id;
DROP INDEX IF EXISTS idx_knowledge_base_chunks;
DROP INDEX IF EXISTS idx_conversations_kb_id;
DROP INDEX IF EXISTS idx_analytics_events_kb_id;
DROP INDEX IF EXISTS idx_benchmark_datasets_kb;
DROP INDEX IF EXISTS idx_benchmark_runs_kb;
DROP INDEX IF EXISTS idx_benchmark_ab_tests_kb;
DROP INDEX IF EXISTS idx_web_sources_kb_id;
DROP INDEX IF EXISTS idx_llm_usage_kb_id;
DROP INDEX IF EXISTS idx_doc_jobs_kb_id;

-- Step 6: Recreate original indexes
CREATE INDEX idx_digital_twins_user_id ON digital_twins(user_id);
CREATE INDEX idx_digital_twins_semantic_config ON digital_twins(semantic_search_threshold, semantic_search_max_results)
    WHERE semantic_search_threshold IS NOT NULL;
CREATE INDEX idx_digital_twins_rag_config ON digital_twins USING gin (rag_config);

-- Recreate indexes in related tables
CREATE INDEX idx_knowledge_base_twin_id ON knowledge_base(twin_id);
CREATE INDEX idx_knowledge_base_chunks ON knowledge_base(twin_id, parent_entry_id, chunk_index);
CREATE INDEX idx_conversations_twin_id ON conversations(twin_id);
CREATE INDEX idx_analytics_events_twin_id ON analytics_events(twin_id);

-- Recreate indexes for benchmark tables
CREATE INDEX IF NOT EXISTS idx_benchmark_datasets_twin ON benchmark_datasets(twin_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_runs_twin ON benchmark_runs(twin_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_ab_tests_twin ON benchmark_ab_tests(twin_id);

-- Recreate indexes for web sources
CREATE INDEX IF NOT EXISTS idx_web_sources_twin_id ON web_sources(twin_id);

-- Recreate indexes for LLM usage tracking
CREATE INDEX IF NOT EXISTS idx_llm_usage_twin_id ON llm_usage(twin_id);

-- Recreate indexes for document processing jobs
CREATE INDEX IF NOT EXISTS idx_doc_jobs_twin_id ON document_processing_jobs(twin_id);

-- Step 7: Update trigger
DROP TRIGGER IF EXISTS update_knowledge_bases_updated_at ON digital_twins;
CREATE TRIGGER update_digital_twins_updated_at BEFORE UPDATE ON digital_twins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Update comments
COMMENT ON TABLE digital_twins IS 'Digital Twins created by professionals for AI-powered customer interactions';
COMMENT ON COLUMN digital_twins.name IS 'Digital Twin display name';
COMMENT ON COLUMN digital_twins.profession IS 'Professional occupation or expertise area';
COMMENT ON COLUMN digital_twins.bio IS 'Professional biography or description';
COMMENT ON COLUMN digital_twins.rag_config IS 'Advanced RAG configuration: hybrid search, reranking, ensemble balancing, etc.';
COMMENT ON COLUMN digital_twins.handover_threshold IS 'Confidence threshold below which to trigger handover to human professional';

-- Remove KB-specific comments
COMMENT ON COLUMN digital_twins.description IS NULL;

-- Rollback complete
DO $$
BEGIN
  RAISE NOTICE 'Rollback 010 complete: knowledge_bases → digital_twins';
  RAISE NOTICE 'WARNING: description, is_public, share_url data has been lost';
END $$;
