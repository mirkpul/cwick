-- Migration 008: Vector Store for Embeddings
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS vector_store (
    id UUID PRIMARY KEY,
    namespace TEXT NOT NULL DEFAULT 'default',
    vector VECTOR(1536) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vector_store_namespace ON vector_store(namespace);
CREATE INDEX IF NOT EXISTS idx_vector_store_updated_at ON vector_store(updated_at);

CREATE TRIGGER update_vector_store_updated_at BEFORE UPDATE ON vector_store
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
