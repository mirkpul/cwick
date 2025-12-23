-- Migration 009: Document Processing Jobs
CREATE TABLE IF NOT EXISTS document_processing_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  twin_id UUID NOT NULL REFERENCES digital_twins(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  result JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_jobs_twin_id ON document_processing_jobs(twin_id);
CREATE INDEX IF NOT EXISTS idx_doc_jobs_status ON document_processing_jobs(status);

CREATE TRIGGER update_document_processing_jobs_updated_at BEFORE UPDATE ON document_processing_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
