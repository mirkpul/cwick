-- Add file upload support to knowledge_base table
-- This migration adds fields to support chunked file uploads with embeddings

ALTER TABLE knowledge_base
ADD COLUMN file_name VARCHAR(255),
ADD COLUMN file_size INTEGER,
ADD COLUMN file_type VARCHAR(100),
ADD COLUMN chunk_index INTEGER DEFAULT 0,
ADD COLUMN total_chunks INTEGER DEFAULT 1,
ADD COLUMN parent_entry_id UUID REFERENCES knowledge_base(id) ON DELETE CASCADE;

-- Add index for efficient chunk queries
CREATE INDEX idx_knowledge_base_parent_entry ON knowledge_base(parent_entry_id);
CREATE INDEX idx_knowledge_base_chunks ON knowledge_base(twin_id, parent_entry_id, chunk_index);

-- Add index for vector similarity search (using pgvector operators)
CREATE INDEX idx_knowledge_base_embedding ON knowledge_base USING ivfflat (embedding vector_cosine_ops);

-- Add comments for documentation
COMMENT ON COLUMN knowledge_base.file_name IS 'Original filename of uploaded file';
COMMENT ON COLUMN knowledge_base.file_size IS 'File size in bytes';
COMMENT ON COLUMN knowledge_base.file_type IS 'MIME type of uploaded file';
COMMENT ON COLUMN knowledge_base.chunk_index IS 'Index of this chunk (0-based) for multi-chunk entries';
COMMENT ON COLUMN knowledge_base.total_chunks IS 'Total number of chunks for this entry';
COMMENT ON COLUMN knowledge_base.parent_entry_id IS 'Reference to parent entry for chunks (NULL for standalone entries)';
COMMENT ON COLUMN knowledge_base.embedding IS 'Vector embedding for semantic search (1536 dimensions for OpenAI ada-002)';
