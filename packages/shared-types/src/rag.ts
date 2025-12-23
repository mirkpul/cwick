/**
 * RAG (Retrieval-Augmented Generation) configuration types
 */

export interface RAGConfig {
  // Similarity thresholds
  knowledgeBaseThreshold: number;
  emailThreshold: number;

  // Hybrid search configuration
  hybridSearchEnabled: boolean;
  vectorWeight: number;
  bm25Weight: number;
  fusionMethod: 'rrf' | 'weighted';

  // Reranking configuration
  rerankingEnabled: boolean;
  useDiversityFilter: boolean;
  diversityThreshold: number;
  useMMR: boolean;
  mmrLambda: number;

  // Semantic boost
  semanticBoostEnabled: boolean;
  maxBoost: number;
  minBoostThreshold: number;
  dynamicBoostEnabled: boolean;

  // Temporal decay (for emails)
  temporalDecayEnabled: boolean;
  decayHalfLifeDays: number;

  // Result limits
  maxResults: number;
  maxEmailRatio: number;
  maxKBRatio: number;

  // Ingestion settings
  ingestion: {
    tableMaxColumns: number;
  };
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  source_type: 'knowledge_base' | 'email' | 'web';
  file_name?: string;
  metadata?: Record<string, any>;
}

export interface RAGSearchRequest {
  query: string;
  twinId: string;
  maxResults?: number;
  config?: Partial<RAGConfig>;
}

export interface RAGSearchResponse {
  results: SearchResult[];
  enhancedQuery?: string;
  queryVariants?: string[];
  processingTimeMs: number;
}

export interface ChunkingConfig {
  strategy: 'semantic' | 'character';
  chunkSize?: number;
  overlap?: number;
  targetChunkSize?: number;
}

export interface DocumentProcessingJob {
  id: string;
  twinId: string;
  fileName: string;
  fileType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalChunks?: number;
  processedChunks?: number;
  error?: string;
  created_at: Date;
  completed_at?: Date;
}
