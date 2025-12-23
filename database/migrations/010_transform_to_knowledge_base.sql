-- Migration 010: Transform digital_twins to knowledge_bases
-- This migration transforms the Digital Twin focused schema to a simple RAG Knowledge Base schema

-- Step 1: Rename the main table
ALTER TABLE digital_twins RENAME TO knowledge_bases;

-- Step 2: Update foreign key columns in related tables
-- Update knowledge_base table
ALTER TABLE knowledge_base RENAME COLUMN twin_id TO kb_id;

-- Update conversations table
ALTER TABLE conversations RENAME COLUMN twin_id TO kb_id;

-- Update analytics_events table
ALTER TABLE analytics_events RENAME COLUMN twin_id TO kb_id;

-- Update benchmark tables (from migration 004)
ALTER TABLE IF EXISTS benchmark_datasets RENAME COLUMN twin_id TO kb_id;
ALTER TABLE IF EXISTS benchmark_runs RENAME COLUMN twin_id TO kb_id;
ALTER TABLE IF EXISTS benchmark_ab_tests RENAME COLUMN twin_id TO kb_id;

-- Update web scraping table (from migration 005)
ALTER TABLE IF EXISTS web_sources RENAME COLUMN twin_id TO kb_id;

-- Update LLM usage tracking table (from migration 007)
ALTER TABLE IF EXISTS llm_usage RENAME COLUMN twin_id TO kb_id;

-- Update document processing jobs table (from migration 009)
ALTER TABLE IF EXISTS document_processing_jobs RENAME COLUMN twin_id TO kb_id;

-- Step 3: Drop Digital Twin specific columns that are no longer needed
ALTER TABLE knowledge_bases
  DROP COLUMN IF EXISTS profession,
  DROP COLUMN IF EXISTS bio,
  DROP COLUMN IF EXISTS personality_traits,
  DROP COLUMN IF EXISTS communication_style,
  DROP COLUMN IF EXISTS capabilities,
  DROP COLUMN IF EXISTS services,
  DROP COLUMN IF EXISTS pricing_info,
  DROP COLUMN IF EXISTS availability_schedule,
  DROP COLUMN IF EXISTS handover_threshold;

-- Step 4: Add new Knowledge Base specific columns
ALTER TABLE knowledge_bases
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_url VARCHAR(255) UNIQUE;

-- Step 5: Update indexes
-- Drop old indexes
DROP INDEX IF EXISTS idx_digital_twins_user_id;
DROP INDEX IF EXISTS idx_digital_twins_semantic_config;
DROP INDEX IF EXISTS idx_digital_twins_rag_config;

-- Create new indexes for knowledge_bases
CREATE INDEX idx_knowledge_bases_user_id ON knowledge_bases(user_id);
CREATE INDEX idx_knowledge_bases_is_public ON knowledge_bases(is_public) WHERE is_public = true;
CREATE INDEX idx_knowledge_bases_share_url ON knowledge_bases(share_url) WHERE share_url IS NOT NULL;
CREATE INDEX idx_knowledge_bases_semantic_config ON knowledge_bases(semantic_search_threshold, semantic_search_max_results)
    WHERE semantic_search_threshold IS NOT NULL;
CREATE INDEX idx_knowledge_bases_rag_config ON knowledge_bases USING gin (rag_config);

-- Update indexes in related tables
DROP INDEX IF EXISTS idx_knowledge_base_twin_id;
CREATE INDEX idx_knowledge_base_kb_id ON knowledge_base(kb_id);

DROP INDEX IF EXISTS idx_knowledge_base_chunks;
CREATE INDEX idx_knowledge_base_chunks ON knowledge_base(kb_id, parent_entry_id, chunk_index);

DROP INDEX IF EXISTS idx_conversations_twin_id;
CREATE INDEX idx_conversations_kb_id ON conversations(kb_id);

DROP INDEX IF EXISTS idx_analytics_events_twin_id;
CREATE INDEX idx_analytics_events_kb_id ON analytics_events(kb_id);

-- Update indexes for benchmark tables
DROP INDEX IF EXISTS idx_benchmark_datasets_twin;
CREATE INDEX IF NOT EXISTS idx_benchmark_datasets_kb ON benchmark_datasets(kb_id);

DROP INDEX IF EXISTS idx_benchmark_runs_twin;
CREATE INDEX IF NOT EXISTS idx_benchmark_runs_kb ON benchmark_runs(kb_id);

DROP INDEX IF EXISTS idx_benchmark_ab_tests_twin;
CREATE INDEX IF NOT EXISTS idx_benchmark_ab_tests_kb ON benchmark_ab_tests(kb_id);

-- Update indexes for web sources
DROP INDEX IF EXISTS idx_web_sources_twin_id;
CREATE INDEX IF NOT EXISTS idx_web_sources_kb_id ON web_sources(kb_id);

-- Update indexes for LLM usage tracking
DROP INDEX IF EXISTS idx_llm_usage_twin_id;
CREATE INDEX IF NOT EXISTS idx_llm_usage_kb_id ON llm_usage(kb_id);

-- Update indexes for document processing jobs
DROP INDEX IF EXISTS idx_doc_jobs_twin_id;
CREATE INDEX IF NOT EXISTS idx_doc_jobs_kb_id ON document_processing_jobs(kb_id);

-- Step 6: Update trigger (it should still work with renamed table)
-- The trigger update_digital_twins_updated_at needs to be recreated
DROP TRIGGER IF EXISTS update_digital_twins_updated_at ON knowledge_bases;
CREATE TRIGGER update_knowledge_bases_updated_at BEFORE UPDATE ON knowledge_bases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 7: Add helpful comments
COMMENT ON TABLE knowledge_bases IS 'Knowledge Bases created by users for RAG-powered chat';
COMMENT ON COLUMN knowledge_bases.description IS 'User-provided description of the Knowledge Base purpose and content';
COMMENT ON COLUMN knowledge_bases.is_public IS 'Whether this KB is publicly accessible via share_url';
COMMENT ON COLUMN knowledge_bases.share_url IS 'Unique URL slug for public access (e.g., /chat/my-kb-slug)';
COMMENT ON COLUMN knowledge_bases.name IS 'Knowledge Base display name';
COMMENT ON COLUMN knowledge_bases.rag_config IS 'Advanced RAG configuration: hybrid search, reranking, ensemble balancing, etc.';

-- Step 8: Generate share_url for existing records (if any)
-- Use a simple slug based on name + random suffix
UPDATE knowledge_bases
SET share_url = CONCAT(
    LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g')),
    '-',
    SUBSTR(MD5(RANDOM()::TEXT), 1, 8)
)
WHERE share_url IS NULL;
