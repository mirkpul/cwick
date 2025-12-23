/**
 * Shared RAG Configuration Types
 * Consolidated type definitions for RAG configuration across the frontend
 */

export interface RAGIngestionConfig {
  tableMaxColumns?: number;
}

export interface RAGConfig {
  // Threshold settings
  knowledgeBaseThreshold?: number;
  emailThreshold?: number;
  similarity_threshold?: number; // Legacy field, maps to knowledgeBaseThreshold

  // Hybrid search settings
  hybridSearchEnabled?: boolean;
  vectorWeight?: number;
  bm25Weight?: number;
  fusionMethod?: string;

  // Reranking settings
  rerankingEnabled?: boolean;
  useDiversityFilter?: boolean;
  diversityThreshold?: number;
  useMMR?: boolean;
  mmrLambda?: number;

  // Semantic boost settings
  semanticBoostEnabled?: boolean;
  maxBoost?: number;
  minBoostThreshold?: number;
  dynamicBoostEnabled?: boolean;

  // Temporal decay settings
  temporalDecayEnabled?: boolean;
  decayHalfLifeDays?: number;

  // Result limits
  maxResults?: number;
  max_context_items?: number; // Legacy field, maps to maxResults
  maxEmailRatio?: number;
  maxKBRatio?: number;

  // Chunking settings (legacy)
  chunking_strategy?: string;
  chunk_size?: number;
  chunk_overlap?: number;

  // Ingestion settings
  ingestion?: RAGIngestionConfig;

  // Allow additional properties
  [key: string]: unknown;
}

export interface SearchResult {
  id: string;
  title?: string;
  content?: string;
  source?: string;
  similarity?: number;
  score?: number;
  senderName?: string;
  senderEmail?: string;
  sentAt?: string;
  created_at?: string;
}
