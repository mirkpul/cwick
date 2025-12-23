/**
 * Application-wide configuration
 * All default values for the VirtualCoach application
 *
 * This centralized configuration file consolidates all hardcoded values
 * from across the codebase to make them easier to maintain and update.
 */

export interface FileUploadConfig {
  maxSizeBytes: number;
  maxSizeMB: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
}

export interface VisualExtractionConfig {
  enabled: boolean;
  imageMimeTypes: string[];
  maxImagesPerDocument: number;
  maxPdfPages: number;
  pdfPageScale: number;
  visionProvider: 'openai' | 'anthropic';
  visionModel: string;
  captionPrompt: string;
  sectionHeading: string;
}

export interface ChunkingConfig {
  maxTokensPerChunk: number;
  overlapTokens: number;
  charactersPerToken: number;
}

export interface SemanticChunkingConfig {
  enabled: boolean;
  maxTokensPerChunk: number;
  minChunkSize: number;
  overlapPercentage: number;
  similarityThreshold: number;
  charactersPerToken: number;
  fallbackToCharBased: boolean;
  maxDocumentTokens: number;
}

export interface LLMProviderConfig {
  embeddingModel: string;
  embeddingDimensions: number;
  legacyEmbeddingModel: string;
}

export interface LLMConfig {
  defaultTemperature: number;
  defaultMaxTokens: number;
  providers: {
    openai: LLMProviderConfig;
    anthropic: Record<string, unknown>;
  };
}

export interface HandoverConfig {
  defaultThreshold: number;
}

export interface EnsembleBalancingConfig {
  enabled: boolean;
  minEmailResults: number;
  minKBResults: number;
  maxEmailRatio: number;
  maxKBRatio: number;
}

export interface SemanticSearchConfig {
  defaultThreshold: number;
  defaultMaxResults: number;
  internalSearchLimit: number;
  minThreshold: number;
  maxThreshold: number;
  minResults: number;
  maxResults: number;
  useAdaptiveFiltering: boolean;
  topScoreGapPercent: number;
  useNormalization: boolean;
  minStdDevAboveMean: number;
  sourceThresholds: {
    email: number;
    knowledgeBase: number;
  };
  ensembleBalancing: EnsembleBalancingConfig;
}

export interface ConversationsConfig {
  messageHistoryLimit: number;
}

export interface SearchConfig {
  defaultLimit: number;
}

export interface DatabaseConfig {
  poolMax: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
}

export interface DocumentPreprocessingConfig {
  enabled: boolean;
  removeHeaders: boolean;
  removeFooters: boolean;
  normalizeWhitespace: boolean;
  removeUrls: boolean;
  maxChunkLength: number;
}

export interface ContextualEnrichmentConfig {
  enabled: boolean;
  useContextGeneration: boolean;
  contextPromptTemplate: string;
  maxContextLength: number;
  cacheContexts: boolean;
}

export interface QueryEnhancementConfig {
  enabled: boolean;
  useHyDE: boolean;
  hydePromptTemplate: string;
  useMultiQuery: boolean;
  queryVariants: number;
  multiQueryPromptTemplate: string;
  useConversationContext: boolean;
  maxContextMessages: number;
  contextInjectionTemplate: string;
}

export interface HybridSearchConfig {
  enabled: boolean;
  vectorWeight: number;
  bm25Weight: number;
  fusionMethod: 'rrf' | 'weighted' | 'score-based';
  rffK: number;
  bm25K1: number;
  bm25B: number;
  topKPerMethod: number;
  finalTopK: number;
}

export interface SemanticBoostConfig {
  enabled: boolean;
  maxBoost: number;
  minThreshold: number;
}

export interface RerankingConfig {
  enabled: boolean;
  method: 'cross-encoder' | 'llm' | 'semantic';
  topK: number;
  finalK: number;
  useDiversityFilter: boolean;
  diversityThreshold: number;
  useMMR: boolean;
  mmrLambda: number;
  semanticBoost: SemanticBoostConfig;
}

export interface PerformanceConfig {
  useBatchEmbeddings: boolean;
  maxBatchSize: number;
  maxBatchTokens: number;
  usePromptCaching: boolean;
  parallelQueries: boolean;
}

export interface AssetEnrichmentTargetConfig {
  enabled: boolean;
  promptTemplate: string;
  maxTokens: number;
  maxColumns?: number;
}

export interface AssetEnrichmentConfig {
  tables: AssetEnrichmentTargetConfig;
  visuals: AssetEnrichmentTargetConfig;
}

export interface RAGOptimizationConfig {
  documentPreprocessing: DocumentPreprocessingConfig;
  contextualEnrichment: ContextualEnrichmentConfig;
  queryEnhancement: QueryEnhancementConfig;
  hybridSearch: HybridSearchConfig;
  reranking: RerankingConfig;
  performance: PerformanceConfig;
  assetEnrichment: AssetEnrichmentConfig;
}

export interface AppConfig {
  fileUpload: FileUploadConfig;
  visualExtraction: VisualExtractionConfig;
  chunking: ChunkingConfig;
  semanticChunking: SemanticChunkingConfig;
  llm: LLMConfig;
  handover: HandoverConfig;
  semanticSearch: SemanticSearchConfig;
  conversations: ConversationsConfig;
  search: SearchConfig;
  database: DatabaseConfig;
  ragOptimization: RAGOptimizationConfig;
}

const config: AppConfig = {
  // File Upload Configuration
  fileUpload: {
    maxSizeBytes: 100 * 1024 * 1024, // 100MB maximum file size
    maxSizeMB: 100,
    allowedMimeTypes: [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/svg+xml',
    ],
    allowedExtensions: ['.pdf', '.txt', '.md', '.csv', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ppt', '.pptx'],
  },

  // Visual Extraction Configuration
  visualExtraction: {
    enabled: true,
    imageMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
    maxImagesPerDocument: 5,
    maxPdfPages: 5,
    pdfPageScale: 1.5,
    visionProvider: 'openai',
    visionModel: 'gpt-4o-mini',
    captionPrompt: `You are analyzing a document image from a knowledge base. First, extract every legible word in the original order (behave like OCR). After the transcription, add a short description of non-textual elements such as diagrams, tables, or logos. Keep the response concise and factual.`,
    sectionHeading: '## Visual Insights',
  },

  // Text Chunking Configuration (Character-based - legacy)
  chunking: {
    maxTokensPerChunk: 700,      // Increased for fewer, richer chunks
    overlapTokens: 40,            // Slightly reduced overlap
    charactersPerToken: 4,        // Estimation ratio for token counting
  },

  // Semantic Chunking Configuration (Recommended for RAG)
  semanticChunking: {
    enabled: true,                // Enable semantic chunking by default
    maxTokensPerChunk: 550,       // Larger semantic chunks for fewer total entries
    minChunkSize: 50,             // Minimum tokens per chunk to avoid tiny chunks
    overlapPercentage: 0.15,      // Reduced overlap to limit duplication
    similarityThreshold: 0.78,    // Cosine similarity threshold for topic boundaries (0-1)
    charactersPerToken: 4,        // Estimation ratio for token counting
    fallbackToCharBased: true,    // Fallback to character-based if semantic fails
    maxDocumentTokens: 6000,      // Cutoff for semantic chunking to avoid oversize prompts
  },

  // LLM Configuration
  llm: {
    defaultTemperature: 0.7,      // Default creativity/randomness (0-1)
    defaultMaxTokens: 10000,      // Default maximum tokens in response
    providers: {
      openai: {
        // Upgraded from text-embedding-ada-002 to text-embedding-3-small
        // Reasons:
        // 1. Better score distribution (less compression in 0.68-0.95 range)
        // 2. Improved retrieval performance
        // 3. Same cost, better quality
        // 4. Supports dimension reduction for cost optimization
        embeddingModel: 'text-embedding-3-small',
        embeddingDimensions: 1536,  // Can be reduced to 512 for lower cost with minimal quality loss

        // Legacy model (keep for reference)
        legacyEmbeddingModel: 'text-embedding-ada-002',
      },
      anthropic: {
        // Future: Anthropic embedding support will be added here
      },
    },
  },

  // Handover Configuration
  handover: {
    defaultThreshold: 0.5,        // Confidence threshold below which to request human assistance
  },

  // Semantic Search Configuration
  semanticSearch: {
    defaultThreshold: 0.20,       // 20% default threshold
    defaultMaxResults: 5,         // Total results in context
    internalSearchLimit: 20,      // Fetch more results, then filter by threshold
    minThreshold: 0.0,            // Minimum allowed threshold value
    maxThreshold: 1.0,            // Maximum allowed threshold value
    minResults: 1,                // Minimum allowed max results
    maxResults: 10,               // Maximum allowed max results

    // Adaptive filtering to handle score compression
    useAdaptiveFiltering: true,   // Enable adaptive threshold based on score distribution
    topScoreGapPercent: 0.05,     // Only keep results within 5% of top score
    useNormalization: true,       // Apply z-score normalization to results
    minStdDevAboveMean: 0.5,      // Minimum standard deviations above mean for normalized filtering

    // Source-specific thresholds (email vs knowledge base)
    sourceThresholds: {
      email: 0.50,                // 50% for emails
      knowledgeBase: 0.20,        // 20% for KB entries
    },

    // Ensemble balancing (when combining email + KB results)
    ensembleBalancing: {
      enabled: true,              // Enable source-aware balancing
      minEmailResults: 1,         // Minimum email results to include (if available)
      minKBResults: 1,            // Minimum KB results to include (if available)
      maxEmailRatio: 0.2,         // Max 20% of results can be emails
      maxKBRatio: 0.8,            // Max 80% of results can be KB entries
    },
  },

  // Conversation Configuration
  conversations: {
    messageHistoryLimit: 10,      // Number of messages to include in context
  },

  // Search Configuration
  search: {
    defaultLimit: 10,             // Default number of search results to return
  },

  // Database Configuration
  database: {
    poolMax: 20,                  // Maximum number of database connections in pool
    idleTimeoutMs: 30000,         // How long a connection can be idle before being closed
    connectionTimeoutMs: 2000,    // How long to wait for a connection before timing out
  },

  // RAG Optimization Configuration (2025 Best Practices)
  ragOptimization: {
    // Document Preprocessing
    documentPreprocessing: {
      enabled: true,
      removeHeaders: true,          // Remove email headers, footers
      removeFooters: true,
      normalizeWhitespace: true,    // Normalize multiple spaces/newlines
      removeUrls: true,             // Remove or normalize URLs
      maxChunkLength: 6000,         // Max chars before truncation
    },

    // Contextual Enrichment (Anthropic technique)
    contextualEnrichment: {
      enabled: true,
      useContextGeneration: true,   // Generate context for each chunk using LLM
      contextPromptTemplate: `Here is the full document:
<document>
{{DOCUMENT}}
</document>

Here is the chunk we want to situate within the whole document:
<chunk>
{{CHUNK}}
</chunk>

Please give a short succinct context (2-3 sentences) to situate this chunk within the overall document for the purposes of improving search retrieval. Answer only with the succinct context and nothing else.`,
      maxContextLength: 200,        // Max chars for generated context
      cacheContexts: true,          // Use prompt caching to reduce costs
    },

    // Query Enhancement (OTTIMIZZATO PER COSTI - Solo essenziale per chat)
    queryEnhancement: {
      enabled: true,

      // HyDE (Hypothetical Document Embeddings)
      // DISABILITATO per chat: riduce 1 chiamata LLM + 1 embedding per query
      // Beneficio marginale vs costo ricorrente
      useHyDE: false,
      hydePromptTemplate: `Given the following question, write a detailed hypothetical answer that would perfectly answer this question:

Question: {{QUERY}}

Write a detailed, informative answer (2-3 paragraphs):`,

      // Multi-Query Expansion
      // DISABILITATO per chat: riduce 1 chiamata LLM + 3 embeddings per query
      // Ridondante con threshold ottimizzati e weighted fusion
      useMultiQuery: false,
      queryVariants: 3,             // Number of query variations to generate
      multiQueryPromptTemplate: `You are a helpful expert. Generate {{COUNT}} different versions of the following question to retrieve relevant documents from a knowledge base. Each version should capture the same intent but use different wording or perspective.

Original question: {{QUERY}}

Provide the variations as a JSON array of strings.`,

      // Conversation Context Injection
      // ABILITATO: essenziale per conversazioni multi-turno (1 chiamata LLM)
      useConversationContext: true,
      maxContextMessages: 3,        // Ridotto da 5 a 3 (sufficiente, meno token)
      contextInjectionTemplate: `Given the conversation history and current question, rephrase the question to be standalone and include relevant context:

Conversation history:
{{HISTORY}}

Current question: {{QUERY}}

Rephrased standalone question:`,
    },

    // Hybrid Search (BM25 + Vector)
    hybridSearch: {
      enabled: true,
      vectorWeight: 0.6,            // 60% weight for vector similarity
      bm25Weight: 0.4,              // 40% weight for BM25 keyword matching
      fusionMethod: 'weighted',     // 'rrf' | 'weighted' | 'score-based' - Using weighted to preserve score quality
      rffK: 60,                     // RRF constant (typical: 60)

      // BM25 Parameters
      bm25K1: 1.5,                  // Term frequency saturation (typical: 1.2-2.0)
      bm25B: 0.75,                  // Length normalization (typical: 0.75)

      // Retrieval settings
      topKPerMethod: 20,            // Fetch top-20 from each method
      finalTopK: 10,                // Final results after fusion
    },

    // Reranking
    reranking: {
      enabled: true,
      method: 'cross-encoder',      // 'cross-encoder' | 'llm' | 'semantic'
      topK: 20,                     // Number of candidates to rerank
      finalK: 5,                    // Final number after reranking

      // Diversity
      useDiversityFilter: true,
      diversityThreshold: 0.85,     // Don't include if >85% similar to already selected

      // MMR (Maximal Marginal Relevance)
      useMMR: false,                // Enable MMR for diversity
      mmrLambda: 0.7,               // 0.7 relevance, 0.3 diversity

      // Semantic Boost Configuration
      semanticBoost: {
        enabled: true,              // Enable semantic boosting based on query term matches
        maxBoost: 0.05,             // Maximum boost amount (5%)
        minThreshold: 0.30,         // Don't boost scores below this threshold (30%)
      },
    },

    // Performance & Costs
    performance: {
      useBatchEmbeddings: true,     // Batch embedding calls
      maxBatchSize: 100,            // Max items per batch
      maxBatchTokens: 6000,         // Total token budget per embedding request
      usePromptCaching: true,       // Use Anthropic prompt caching
      parallelQueries: true,        // Run query variants in parallel
    },
    assetEnrichment: {
      tables: {
        enabled: true,
        promptTemplate: `You are optimizing tabular data for retrieval. Given the information below, produce enriched insights that include:
- A short objective summary referencing key metrics or trends
- 2-3 bullet highlights describing relationships or anomalies
- 1 follow-up question a user might ask about this data
Respond strictly in JSON:
{
  "summary": "...",
  "highlights": ["...", "..."],
  "question": "..."
}`,
        maxTokens: 200,
        maxColumns: 10,
      },
      visuals: {
        enabled: true,
        promptTemplate: `You are converting visual summaries into retrieval-friendly descriptions. For the provided description, produce:
- A punchy title
- 2-3 bullet highlights linking the visual to potential business questions
- 1 suggested follow-up question
Return JSON:
{
  "title": "...",
  "highlights": ["...", "..."],
  "question": "..."
}`,
        maxTokens: 180,
      },
    },
  },
};

/**
 * Validate configuration values at startup
 * Throws an error if any configuration value is invalid
 */
function validateConfig(): void {
  const errors: string[] = [];

  const tablesConfig = config.ragOptimization.assetEnrichment?.tables;
  if (!tablesConfig || typeof tablesConfig.maxColumns !== 'number' || tablesConfig.maxColumns <= 0) {
    errors.push('ragOptimization.assetEnrichment.tables.maxColumns must be positive');
  }

  // Validate semantic chunking configuration
  const sc = config.semanticChunking;

  if (sc.overlapPercentage < 0 || sc.overlapPercentage > 1) {
    errors.push('semanticChunking.overlapPercentage must be between 0 and 1');
  }

  if (sc.similarityThreshold < 0 || sc.similarityThreshold > 1) {
    errors.push('semanticChunking.similarityThreshold must be between 0 and 1');
  }

  if (sc.maxTokensPerChunk <= 0 || !Number.isInteger(sc.maxTokensPerChunk)) {
    errors.push('semanticChunking.maxTokensPerChunk must be a positive integer');
  }

  if (sc.minChunkSize <= 0 || !Number.isInteger(sc.minChunkSize)) {
    errors.push('semanticChunking.minChunkSize must be a positive integer');
  }

  if (sc.minChunkSize > sc.maxTokensPerChunk) {
    errors.push('semanticChunking.minChunkSize must be less than or equal to maxTokensPerChunk');
  }

  if (!Number.isInteger(sc.maxDocumentTokens) || sc.maxDocumentTokens <= 0) {
    errors.push('semanticChunking.maxDocumentTokens must be a positive integer');
  }

  // Validate semantic search configuration
  const ss = config.semanticSearch;

  if (ss.defaultThreshold < 0 || ss.defaultThreshold > 1) {
    errors.push('semanticSearch.defaultThreshold must be between 0 and 1');
  }

  if (ss.topScoreGapPercent < 0 || ss.topScoreGapPercent > 1) {
    errors.push('semanticSearch.topScoreGapPercent must be between 0 and 1');
  }

  if (ss.minStdDevAboveMean < 0) {
    errors.push('semanticSearch.minStdDevAboveMean must be non-negative');
  }

  if (!Number.isInteger(ss.defaultMaxResults) || ss.defaultMaxResults < 1) {
    errors.push('semanticSearch.defaultMaxResults must be a positive integer');
  }

  if (!Number.isInteger(ss.internalSearchLimit) || ss.internalSearchLimit < ss.defaultMaxResults) {
    errors.push('semanticSearch.internalSearchLimit must be >= defaultMaxResults');
  }

  // Validate LLM configuration
  const llm = config.llm;

  if (llm.defaultTemperature < 0 || llm.defaultTemperature > 2) {
    errors.push('llm.defaultTemperature must be between 0 and 2');
  }

  if (!Number.isInteger(llm.defaultMaxTokens) || llm.defaultMaxTokens <= 0) {
    errors.push('llm.defaultMaxTokens must be a positive integer');
  }

  if (!Number.isInteger(llm.providers.openai.embeddingDimensions) ||
      llm.providers.openai.embeddingDimensions <= 0) {
    errors.push('llm.providers.openai.embeddingDimensions must be a positive integer');
  }

  // Validate handover configuration
  const handover = config.handover;

  if (handover.defaultThreshold < 0 || handover.defaultThreshold > 1) {
    errors.push('handover.defaultThreshold must be between 0 and 1');
  }

  // Validate file upload configuration
  const fileUpload = config.fileUpload;

  if (!Number.isInteger(fileUpload.maxSizeBytes) || fileUpload.maxSizeBytes <= 0) {
    errors.push('fileUpload.maxSizeBytes must be a positive integer');
  }

  // Validate performance configuration
  const performance = config.ragOptimization.performance;

  if (!Number.isInteger(performance.maxBatchSize) || performance.maxBatchSize <= 0) {
    errors.push('ragOptimization.performance.maxBatchSize must be a positive integer');
  }

  if (!Number.isInteger(performance.maxBatchTokens) || performance.maxBatchTokens <= 0) {
    errors.push('ragOptimization.performance.maxBatchTokens must be a positive integer');
  }

  const assetEnrichment = config.ragOptimization.assetEnrichment;
  const tableEnrichment = assetEnrichment.tables;
  const visualEnrichment = assetEnrichment.visuals;

  if (tableEnrichment.maxTokens <= 0) {
    errors.push('ragOptimization.assetEnrichment.tables.maxTokens must be positive');
  }

  if (visualEnrichment.maxTokens <= 0) {
    errors.push('ragOptimization.assetEnrichment.visuals.maxTokens must be positive');
  }

  if (!Array.isArray(fileUpload.allowedMimeTypes) || fileUpload.allowedMimeTypes.length === 0) {
    errors.push('fileUpload.allowedMimeTypes must be a non-empty array');
  }

  // Validate visual extraction configuration
  const visualExtraction = config.visualExtraction;
  if (!Array.isArray(visualExtraction.imageMimeTypes) || visualExtraction.imageMimeTypes.length === 0) {
    errors.push('visualExtraction.imageMimeTypes must be a non-empty array');
  }
  if (!Number.isInteger(visualExtraction.maxImagesPerDocument) || visualExtraction.maxImagesPerDocument <= 0) {
    errors.push('visualExtraction.maxImagesPerDocument must be a positive integer');
  }
  if (!Number.isInteger(visualExtraction.maxPdfPages) || visualExtraction.maxPdfPages <= 0) {
    errors.push('visualExtraction.maxPdfPages must be a positive integer');
  }
  if (typeof visualExtraction.pdfPageScale !== 'number' || visualExtraction.pdfPageScale <= 0) {
    errors.push('visualExtraction.pdfPageScale must be a positive number');
  }
  if (!visualExtraction.sectionHeading || visualExtraction.sectionHeading.trim().length === 0) {
    errors.push('visualExtraction.sectionHeading must be a non-empty string');
  }
  if (!visualExtraction.captionPrompt || visualExtraction.captionPrompt.trim().length === 0) {
    errors.push('visualExtraction.captionPrompt must be a non-empty string');
  }
  if (!['openai', 'anthropic'].includes(visualExtraction.visionProvider)) {
    errors.push('visualExtraction.visionProvider must be openai or anthropic');
  }

  // Validate RAG optimization configuration
  const rag = config.ragOptimization;

  if (rag.hybridSearch.vectorWeight < 0 || rag.hybridSearch.vectorWeight > 1) {
    errors.push('ragOptimization.hybridSearch.vectorWeight must be between 0 and 1');
  }

  if (rag.hybridSearch.bm25Weight < 0 || rag.hybridSearch.bm25Weight > 1) {
    errors.push('ragOptimization.hybridSearch.bm25Weight must be between 0 and 1');
  }

  if (Math.abs(rag.hybridSearch.vectorWeight + rag.hybridSearch.bm25Weight - 1.0) > 0.01) {
    errors.push('ragOptimization.hybridSearch.vectorWeight + bm25Weight must equal 1.0');
  }

  if (!['rrf', 'weighted', 'score-based'].includes(rag.hybridSearch.fusionMethod)) {
    errors.push('ragOptimization.hybridSearch.fusionMethod must be rrf, weighted, or score-based');
  }

  if (rag.reranking.diversityThreshold < 0 || rag.reranking.diversityThreshold > 1) {
    errors.push('ragOptimization.reranking.diversityThreshold must be between 0 and 1');
  }

  if (rag.reranking.mmrLambda < 0 || rag.reranking.mmrLambda > 1) {
    errors.push('ragOptimization.reranking.mmrLambda must be between 0 and 1');
  }

  if (rag.queryEnhancement.queryVariants < 1 || rag.queryEnhancement.queryVariants > 10) {
    errors.push('ragOptimization.queryEnhancement.queryVariants must be between 1 and 10');
  }

  // If there are validation errors, throw them
  if (errors.length > 0) {
    const errorMessage = 'Configuration validation failed:\n  - ' + errors.join('\n  - ');
    throw new Error(errorMessage);
  }
}

// Run validation on module load
validateConfig();

export default config;
