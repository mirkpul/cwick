-- Add semantic search configuration to digital_twins table
-- This enables configurable semantic search for knowledge base integration in LLM context

ALTER TABLE digital_twins
ADD COLUMN semantic_search_threshold DECIMAL(3,2) DEFAULT 0.80
    CHECK (semantic_search_threshold >= 0 AND semantic_search_threshold <= 1),
ADD COLUMN semantic_search_max_results INTEGER DEFAULT 3
    CHECK (semantic_search_max_results > 0 AND semantic_search_max_results <= 10);

-- Add comments for documentation
COMMENT ON COLUMN digital_twins.semantic_search_threshold IS
    'Minimum similarity score (0-1) for knowledge base entries to be included in LLM context. Default: 0.80 (80% match)';

COMMENT ON COLUMN digital_twins.semantic_search_max_results IS
    'Maximum number of knowledge base entries to include in LLM context. Default: 3, Max: 10';

-- Create index for faster queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_digital_twins_semantic_config
ON digital_twins(semantic_search_threshold, semantic_search_max_results)
WHERE semantic_search_threshold IS NOT NULL;
