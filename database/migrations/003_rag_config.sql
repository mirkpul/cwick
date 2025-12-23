-- Add RAG configuration field to digital_twins table
-- This allows per-twin customization of RAG parameters

ALTER TABLE digital_twins
ADD COLUMN IF NOT EXISTS rag_config JSONB DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN digital_twins.rag_config IS 'Per-twin RAG configuration: thresholds, weights, reranking settings';

-- Create index for efficient queries (if needed in the future)
CREATE INDEX IF NOT EXISTS idx_digital_twins_rag_config ON digital_twins USING gin (rag_config);
