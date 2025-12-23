import type { QueryResult } from 'pg';
import pdfParse from 'pdf-parse';
import ChunkingService from './chunkingService';
import SemanticChunkingService from './semanticChunkingService';
import type { SemanticChunk } from './semanticChunkingService';
import queryEnhancementService from './queryEnhancementService';
import LLMService from './llmService';
import VisualExtractionService, { VisualInsightSection } from './visualExtractionService';
import structuredTableExtractionService, { StructuredTable } from './structuredTableExtractionService';
import powerpointExtractionService, { PowerPointSlide } from './powerpointExtractionService';
import llmService from './llmService';
import type { KnowledgeBaseEntry } from './digitalTwinService';
import vectorStoreService from './vectorStoreService';
import db from '../config/database';
import logger from '../config/logger';
import config from '../config/appConfig';

interface FileProcessingOptions {
    provider?: string;
    chunkSize?: number | null;
    chunkOverlap?: number | null;
    useSemanticChunking?: boolean;
    maxSizeBytes?: number;
}

interface ValidationResult {
    valid: boolean;
    errors: string[];
}

interface ProcessFileResult {
    success: boolean;
    entriesCreated: number;
    fileName: string;
    fileSize: number;
    chunks: number;
}

interface ConversationHistoryEntry {
    sender: string;
    content: string;
    [key: string]: unknown;
}

interface SearchOptions {
    limit?: number;
    provider?: string;
    conversationHistory?: ConversationHistoryEntry[];
    useAdaptive?: boolean;
    threshold?: number;
}

interface SearchResult {
    id: string;
    title: string;
    content: string;
    content_type: string;
    file_name: string;
    chunk_index: number;
    total_chunks: number;
    created_at: Date;
    source: string;
    similarity: number;
    normalizedScore?: number;
    _stats?: { mean: number; stdDev: number };
}

interface KnowledgeFile {
    id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    total_chunks: number;
    created_at: Date;
}

type TableRowGroup = {
    label: string;
    rows: string[][];
};

type LimitedTableRowGroup = TableRowGroup & {
    truncatedRows?: number;
};

class FileProcessingService {
    private static readonly MAX_TABLE_COLUMNS = config.ragOptimization.assetEnrichment.tables.maxColumns || 10;
    private static readonly TABLE_ROWS_PER_CHUNK = 25;
    private static readonly MAX_TABLE_DATA_CHUNKS = 6;
    private static readonly MONTH_DEFINITIONS = [
        { canonical: 'January', patterns: ['january', 'jan'] },
        { canonical: 'February', patterns: ['february', 'feb'] },
        { canonical: 'March', patterns: ['march', 'mar'] },
        { canonical: 'April', patterns: ['april', 'apr'] },
        { canonical: 'May', patterns: ['may'] },
        { canonical: 'June', patterns: ['june', 'jun'] },
        { canonical: 'July', patterns: ['july', 'jul'] },
        { canonical: 'August', patterns: ['august', 'aug'] },
        { canonical: 'September', patterns: ['september', 'sept', 'sep'] },
        { canonical: 'October', patterns: ['october', 'oct'] },
        { canonical: 'November', patterns: ['november', 'nov'] },
        { canonical: 'December', patterns: ['december', 'dec'] },
    ];
    private static readonly QUARTER_DEFINITIONS = [
        { canonical: 'Q1', patterns: ['q1', 'quarter 1'] },
        { canonical: 'Q2', patterns: ['q2', 'quarter 2'] },
        { canonical: 'Q3', patterns: ['q3', 'quarter 3'] },
        { canonical: 'Q4', patterns: ['q4', 'quarter 4'] },
    ];
    private static readonly REGION_DEFINITIONS = [
        { canonical: 'North America', patterns: ['north america', 'united states', 'usa', 'canada'] },
        { canonical: 'Europe', patterns: ['europe', 'emea', 'united kingdom', 'uk', 'germany', 'france', 'italy', 'spain'] },
        { canonical: 'Latin America', patterns: ['latin america', 'latam', 'brazil', 'mexico', 'argentina', 'chile'] },
        { canonical: 'Asia Pacific', patterns: ['asia', 'apac', 'india', 'china', 'japan', 'singapore', 'australia'] },
        { canonical: 'Middle East & Africa', patterns: ['middle east', 'mea', 'uae', 'dubai', 'saudi', 'africa', 'south africa', 'nigeria', 'egypt'] },
    ];
    private static readonly DEPARTMENT_DEFINITIONS = [
        { canonical: 'Marketing', patterns: ['marketing', 'growth'] },
        { canonical: 'Sales', patterns: ['sales'] },
        { canonical: 'Product', patterns: ['product', 'engineering', 'development', 'r&d', 'rd'] },
        { canonical: 'Customer Success', patterns: ['customer success', 'support', 'service'] },
        { canonical: 'Finance', patterns: ['finance', 'financial', 'accounting'] },
        { canonical: 'Human Resources', patterns: ['hr', 'people', 'talent'] },
        { canonical: 'Operations', patterns: ['operations', 'ops'] },
    ];
    private supportedTypes: string[];
    private maxSizeBytes: number;

    constructor() {
        this.supportedTypes = config.fileUpload.allowedMimeTypes;
        this.maxSizeBytes = config.fileUpload.maxSizeBytes;
    }

    /**
     * Validate embedding vector before database insertion
     * Ensures the embedding is a valid array of finite numbers with correct dimensions
     */
    validateEmbedding(embedding: number[], expectedDimension = 1536): boolean {
        if (!Array.isArray(embedding)) {
            throw new Error('Embedding must be an array');
        }

        if (embedding.length !== expectedDimension) {
            throw new Error(
                `Embedding dimension mismatch: expected ${expectedDimension}, got ${embedding.length}`
            );
        }

        for (let i = 0; i < embedding.length; i++) {
            const value = embedding[i];
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                throw new Error(
                    `Invalid embedding value at index ${i}: ${value} (must be a finite number)`
                );
            }
        }

        return true;
    }

    /**
     * Get list of supported file types
     */
    getSupportedFileTypes(): string[] {
        return [...this.supportedTypes];
    }

    /**
     * Validate file before processing
     */
    validateFile(file: Express.Multer.File, options: FileProcessingOptions = {}): ValidationResult {
        const errors: string[] = [];
        const maxSize = options.maxSizeBytes || this.maxSizeBytes;

        if (!file) {
            errors.push('No file provided');
            return { valid: false, errors };
        }

        if (!this.supportedTypes.includes(file.mimetype)) {
            errors.push(`Unsupported file type: ${file.mimetype}`);
        }

        if (file.size > maxSize) {
            errors.push(`File size exceeds limit of ${maxSize} bytes`);
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Extract text content from file buffer based on file type
     */
    async extractTextFromFile(buffer: Buffer, mimeType: string): Promise<string> {
        try {
            switch (mimeType) {
                case 'application/pdf': {
                    const pdfData = await pdfParse(buffer);
                    return pdfData.text;
                }
                case 'text/plain':
                case 'text/markdown':
                case 'text/csv':
                    return buffer.toString('utf-8');

                default:
                    throw new Error(`Unsupported file type: ${mimeType}`);
            }
        } catch (error) {
            logger.error('Text extraction error:', error);
            throw error;
        }
    }

    /**
     * Process uploaded file for knowledge base
     * Extracts text, chunks it, generates embeddings, and stores in database
     */
    async processFileForKnowledgeBase(
        kbId: string,
        file: Express.Multer.File,
        options: FileProcessingOptions = {}
    ): Promise<ProcessFileResult> {
        try {
            const {
                provider = 'openai',
                chunkSize = null,
                chunkOverlap = null,
                useSemanticChunking = config.semanticChunking.enabled,
            } = options;

            logger.info(`Processing file for twin ${kbId}: ${file.originalname}`);
            logger.info(`Using ${useSemanticChunking ? 'semantic' : 'character-based'} chunking`);

            const isImageOnly = VisualExtractionService.isImageMimeType(file.mimetype);
            const isPowerPoint = powerpointExtractionService.isPowerPointFile(file);

            // Extract text from file when supported
            let extractedText = '';
            if (!isImageOnly && !isPowerPoint) {
                extractedText = await this.extractTextFromFile(
                    file.buffer,
                    file.mimetype
                );
            }

            const visualInsights = await VisualExtractionService.extractVisualInsights(file);
            const visualSections = visualInsights?.sections ?? [];
            let powerpointSlides: PowerPointSlide[] = [];
            if (isPowerPoint) {
                powerpointSlides = await powerpointExtractionService.extractSlides(file);
                if (powerpointSlides.length > 0) {
                    logger.info(`Extracted ${powerpointSlides.length} PowerPoint slides`, {
                        fileName: file.originalname,
                    });
                }
            }
            let narrativeContent = extractedText;
            if ((!narrativeContent || !narrativeContent.trim()) && powerpointSlides.length > 0) {
                narrativeContent = powerpointSlides
                    .map(slide => {
                        const slideNumber = typeof slide.index === 'number' ? slide.index + 1 : undefined;
                        const label = slideNumber ? `Slide ${slideNumber}` : 'Slide';
                        const title = slide.title ? ` - ${slide.title}` : '';
                        return `${label}${title}\n${slide.text}`;
                    })
                    .join('\n\n---\n\n');
            }

            const structuredTables = await structuredTableExtractionService.extractStructuredTables({
                mimeType: file.mimetype,
                buffer: file.buffer,
                rawText: narrativeContent,
                fileName: file.originalname,
            });
            const allStructuredTables = [...structuredTables, ...(visualInsights?.tables ?? [])];
            let validatedTables = await this.validateTablesWithLLM(allStructuredTables, provider);
            validatedTables = await this.enrichStructuredTables(validatedTables, provider);

            if (allStructuredTables.length > 0) {
                logger.info('Structured tables detected', {
                    fileName: file.originalname,
                    tableCount: allStructuredTables.length,
                    validated: validatedTables.filter(t => t.validation?.status === 'passed').length,
                });
            }

            if (
                (!extractedText || extractedText.trim().length === 0) &&
                visualSections.length === 0 &&
                validatedTables.length === 0 &&
                powerpointSlides.length === 0
            ) {
                throw new Error('No text content found in file');
            }

            if (visualSections.length > 0) {
                logger.info('Visual insights extracted for document', {
                    fileName: file.originalname,
                    mimeType: file.mimetype,
                    sections: visualSections.length,
                });
            }

            // Chunk the text using semantic or character-based method
            let textChunks: SemanticChunk[] = [];
            const shouldChunkNarrative =
                narrativeContent &&
                narrativeContent.trim().length > 0 &&
                file.mimetype !== 'text/csv' &&
                !isPowerPoint;

            if (shouldChunkNarrative) {
                if (useSemanticChunking) {
                    // Use semantic chunking with built-in fallback
                    textChunks = await SemanticChunkingService.chunkDocumentWithFallback(
                        narrativeContent,
                        {
                            fileName: file.originalname,
                            fileSize: file.size,
                            fileType: file.mimetype,
                        },
                        {
                            maxTokens: chunkSize || config.semanticChunking.maxTokensPerChunk,
                            overlapPercentage: config.semanticChunking.overlapPercentage,
                            similarityThreshold: config.semanticChunking.similarityThreshold,
                            minChunkSize: config.semanticChunking.minChunkSize,
                            provider,
                        }
                    );
                    logger.info(`Semantic chunking created ${textChunks.length} chunks`);
                } else {
                    // Use traditional character-based chunking
                    const characterChunks = ChunkingService.chunkDocument(
                        narrativeContent,
                        {
                            fileName: file.originalname,
                            fileSize: file.size,
                            fileType: file.mimetype,
                        },
                        {
                            maxTokens: chunkSize || config.chunking.maxTokensPerChunk,
                            overlap: chunkOverlap || config.chunking.overlapTokens,
                        }
                    );
                    textChunks = characterChunks.map(chunk => ({
                        text: chunk.text,
                        embeddingText: chunk.text,
                        index: chunk.index,
                        totalChunks: chunk.totalChunks,
                        sentenceCount: SemanticChunkingService.splitIntoSentences(chunk.text).length,
                        metadata: chunk.metadata,
                    }));
                    logger.info(`Character-based chunking created ${textChunks.length} chunks`);
                }
            }

            const visualChunks = this.buildVisualChunks(visualSections);
            if (visualChunks.length > 0) {
                logger.info(`Appending ${visualChunks.length} visual insight chunks`, {
                    fileName: file.originalname,
                });
            }

            const tableChunks = this.buildTableChunks(validatedTables);
            if (tableChunks.length > 0) {
                logger.info(`Appending ${tableChunks.length} structured table chunks`, {
                    fileName: file.originalname,
                });
            }

            const powerpointChunks = this.buildPowerPointChunks(powerpointSlides, file.originalname);

            const chunks = this.reindexChunks([...textChunks, ...visualChunks, ...tableChunks, ...powerpointChunks]);

            const totalTextLength = chunks.reduce((sum, chunk) => sum + (chunk.text?.length || 0), 0);
            const averageChars = chunks.length ? Math.round(totalTextLength / chunks.length) : 0;
            const approxTokens = averageChars
                ? Math.round(averageChars / config.chunking.charactersPerToken)
                : 0;

            logger.info('Ingestion chunk metrics', {
                fileName: file.originalname,
                totalChunks: chunks.length,
                tableChunks: tableChunks.length,
                visualChunks: visualChunks.length,
                textChunks: textChunks.length,
                averageChars,
                approxTokens,
            });

            logger.info(`Created ${chunks.length} chunks from file ${file.originalname}`);

            // Generate embeddings for all chunks
            const chunkTexts = chunks.map(chunk =>
                this.buildEmbeddingPayload(chunk, file.originalname)
            );
            const embeddings = await LLMService.generateBatchEmbeddings(
                chunkTexts,
                provider
            );

            logger.info(`Generated ${embeddings.length} embeddings`);

            // Store chunks in database with embeddings
            let parentEntryId = null;
            const entries = [];

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const embedding = embeddings[i];

                // Validate embedding before insertion
                this.validateEmbedding(embedding);

                // Convert embedding array to PostgreSQL vector format
                const embeddingVector = `[${embedding.join(',')}]`;

                const insertResult: QueryResult<KnowledgeBaseEntry> = await db.query<KnowledgeBaseEntry>(
                    `INSERT INTO knowledge_base (
            kb_id,
            title,
            content,
            content_type,
            file_name,
            file_size,
            file_type,
            chunk_index,
            total_chunks,
            parent_entry_id,
            embedding
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id`,
                    [
                        kbId,
                        `${file.originalname} - Part ${chunk.index + 1}`,
                        chunk.text,
                        'document',
                        file.originalname,
                        file.size,
                        file.mimetype,
                        chunk.index,
                        chunk.totalChunks,
                        chunk.index === 0 ? null : parentEntryId,
                        embeddingVector,
                    ]
                );
                // First chunk becomes the parent for subsequent chunks
                if (chunk.index === 0) {
                    parentEntryId = insertResult.rows[0].id;
                }

                entries.push(insertResult.rows[0]);

                // Upsert into vector service if enabled
                await vectorStoreService.upsertEmbedding({
                    id: String(insertResult.rows[0].id),
                    vector: embedding,
                    metadata: {
                        kbId,
                        source: 'knowledge_base',
                        fileName: file.originalname,
                        contentType: chunk.contentType || 'document',
                        chunkIndex: chunk.index,
                        totalChunks: chunk.totalChunks,
                    },
                    namespace: 'knowledge_base',
                });
            }

            logger.info(`Stored ${entries.length} entries in knowledge base`);

            return {
                success: true,
                entriesCreated: entries.length,
                fileName: file.originalname,
                fileSize: file.size,
                chunks: chunks.length,
            };
        } catch (error) {
            logger.error('File processing error:', error);
            throw error;
        }
    }

    /**
     * Search knowledge base using semantic similarity
     */
    async searchKnowledgeBase(kbId: string, query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
        try {
            const { limit = 10, provider = 'openai', conversationHistory = [] } = options;

            // Apply query enhancement if enabled (lazy load to avoid circular deps)
            let searchQuery = query;

            if (config.ragOptimization?.queryEnhancement?.enabled) {
                try {
                    const enhanced = await queryEnhancementService.enhanceQuery(
                        query,
                        conversationHistory,
                        {
                            useContextInjection: config.ragOptimization.queryEnhancement.useConversationContext,
                            useHyDE: false, // Don't use HyDE here, too expensive for base search
                            useMultiQuery: false, // Base search uses single query
                        }
                    );
                    searchQuery = enhanced.enhancedQuery || query;

                    logger.debug('Query enhanced for search', {
                        original: query,
                        enhanced: searchQuery,
                    });
                } catch (error) {
                    logger.warn('Query enhancement failed, using original query', { error: (error as Error).message });
                    searchQuery = query;
                }
            }

            // Generate embedding for search query
            const queryEmbedding = await LLMService.generateEmbedding(searchQuery, provider);

            // Validate embedding before use
            this.validateEmbedding(queryEmbedding);

            const embeddingVector = `[${queryEmbedding.join(',')}]`;

            // Perform vector similarity search
            const result = await db.query(
                `SELECT
          id,
          title,
          content,
          content_type,
          file_name,
          chunk_index,
          total_chunks,
          created_at,
          'knowledge_base' as source,
          1 - (embedding <=> $2::vector) as similarity
        FROM knowledge_base
        WHERE kb_id = $1 AND embedding IS NOT NULL
        ORDER BY embedding <=> $2::vector
        LIMIT $3`,
                [kbId, embeddingVector, limit]
            );

            // Log results
            console.log('\n=== KNOWLEDGE BASE SEARCH (ENHANCED) ===');
            console.log(`Original Query: "${query}"`);
            if (searchQuery !== query) {
                console.log(`Enhanced Query: "${searchQuery}"`);
            }
            console.log(`Twin ID: ${kbId}`);
            console.log(`Found ${result.rows.length} results:`);
            result.rows.forEach((r, idx) => {
                console.log(`\n[${idx + 1}] Score: ${r.similarity.toFixed(4)} | Title: ${r.title}`);
                console.log(`File: ${r.file_name} (Chunk ${r.chunk_index})`);
                console.log(`Preview: ${r.content ? r.content.substring(0, 150).replace(/\n/g, ' ') + '...' : 'No content'}`);
            });
            console.log('=====================================\n');

            return result.rows as SearchResult[];
        } catch (error) {
            logger.error('Knowledge base search error:', error);
            throw error;
        }
    }

    /**
     * Search knowledge base with adaptive filtering to handle embedding score compression
     */
    async searchKnowledgeBaseWithAdaptiveFiltering(
        kbId: string,
        query: string,
        options: SearchOptions = {}
    ): Promise<SearchResult[]> {
        // Input validation
        if (!kbId || typeof kbId !== 'string' || kbId.trim().length === 0) {
            throw new Error('Invalid kbId: must be a non-empty string');
        }

        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            throw new Error('Invalid query: must be a non-empty string');
        }

        if (query.length > 10000) {
            throw new Error('Query too long: maximum 10,000 characters');
        }

        try {
            const {
                limit = config.semanticSearch.defaultMaxResults,
                provider = 'openai',
                useAdaptive = config.semanticSearch.useAdaptiveFiltering,
                threshold = config.semanticSearch.defaultThreshold,
            } = options;

            // Validate limit parameter
            if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
                throw new Error('Invalid limit: must be an integer between 1 and 100');
            }

            // Fetch more results for statistical analysis
            const rawResults = await this.searchKnowledgeBase(kbId, query, {
                limit: config.semanticSearch.internalSearchLimit,
                provider,
            });

            if (rawResults.length === 0) {
                logger.info(`No results found for query: "${query}"`);
                return [];
            }

            // Log raw score distribution for debugging
            const scores = rawResults.map(r => r.similarity);
            const minScore = Math.min(...scores);
            const maxScore = Math.max(...scores);
            const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

            logger.info(
                `Search results for "${query.substring(0, 50)}...": ` +
                `count=${rawResults.length}, ` +
                `scores=[${minScore.toFixed(3)}, ${maxScore.toFixed(3)}], ` +
                `avg=${avgScore.toFixed(3)}`
            );

            if (!useAdaptive) {
                // Simple threshold filtering
                const filtered = rawResults.filter(
                    r => r.similarity >= threshold
                );
                return filtered.slice(0, limit);
            }

            // Adaptive filtering with multiple strategies
            let filtered = rawResults;

            // Strategy 1: Top score gap filtering
            // Keep only results within X% of the top score
            if (config.semanticSearch.topScoreGapPercent > 0) {
                const topScore = rawResults[0].similarity;
                const minAcceptableScore = topScore - config.semanticSearch.topScoreGapPercent;

                // Ensure we don't go below the absolute minimum threshold
                const effectiveThreshold = Math.max(minAcceptableScore, threshold);

                filtered = filtered.filter(r => r.similarity >= effectiveThreshold);
                logger.info(
                    `After top-gap filtering (${config.semanticSearch.topScoreGapPercent}): ` +
                    `${filtered.length} results (threshold: ${effectiveThreshold.toFixed(3)})`
                );
            }

            // Strategy 2: Z-score normalization filtering
            // Filter out results that are statistically insignificant
            if (config.semanticSearch.useNormalization && filtered.length >= 5) {
                const normalizedResults = this.normalizeScores(filtered);

                filtered = normalizedResults.filter(
                    r => (r.normalizedScore || 0) >= config.semanticSearch.minStdDevAboveMean
                );

                logger.info(
                    `After z-score filtering (>${config.semanticSearch.minStdDevAboveMean} std): ` +
                    `${filtered.length} results`
                );
            }

            // Strategy 3: Apply base threshold
            filtered = filtered.filter(
                r => r.similarity >= threshold
            );

            logger.info(
                `After threshold filtering (>=${threshold}): ` +
                `${filtered.length} results`
            );

            // Return top N results
            const finalResults = filtered.slice(0, limit);

            if (finalResults.length > 0) {
                logger.info(
                    `Final results: ${finalResults.length} entries with scores ` +
                    `[${finalResults[0].similarity.toFixed(3)} - ` +
                    `${finalResults[finalResults.length - 1].similarity.toFixed(3)}]`
                );

                // Log detailed results to standard out for visibility
                console.log('\n=== KNOWLEDGE BASE SEARCH RESULTS ===');
                console.log(`Query: "${query}"`);
                console.log(`Found ${finalResults.length} results:`);
                finalResults.forEach((r, idx) => {
                    console.log(`\n[${idx + 1}] Score: ${r.similarity.toFixed(4)} | Title: ${r.title}`);
                    console.log(`File: ${r.file_name} (Chunk ${r.chunk_index})`);
                    console.log(`Preview: ${r.content ? r.content.substring(0, 150).replace(/\n/g, ' ') + '...' : 'No content'}`);
                });
                console.log('=====================================\n');
            } else {
                console.log('\n=== KNOWLEDGE BASE SEARCH RESULTS ===');
                console.log(`Query: "${query}"`);
                console.log('No results found matching the criteria.');
                console.log('=====================================\n');
            }

            return finalResults;
        } catch (error) {
            logger.error('Adaptive search error:', error);
            throw error;
        }
    }

    /**
     * Normalize similarity scores using z-score normalization
     */
    private normalizeScores(results: SearchResult[]): SearchResult[] {
        // Handle edge case: empty array
        if (!results || results.length === 0) {
            return [];
        }

        // Handle edge case: single result (perfect match by definition)
        if (results.length === 1) {
            return results.map(r => ({
                ...r,
                normalizedScore: 1.0,
                _stats: { mean: r.similarity, stdDev: 0 },
            }));
        }

        const scores = results.map(r => r.similarity);
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

        // Calculate standard deviation
        const squaredDiffs = scores.map(score => Math.pow(score - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / scores.length;
        const stdDev = Math.sqrt(variance);

        // Handle edge case: all scores identical (stdDev === 0)
        // This means all results are equally relevant, so mark them all as 1.0
        if (stdDev === 0) {
            return results.map(r => ({
                ...r,
                normalizedScore: 1.0,
                _stats: { mean, stdDev: 0 },
            }));
        }

        // Calculate z-scores
        return results.map(r => ({
            ...r,
            normalizedScore: (r.similarity - mean) / stdDev,
            _stats: { mean, stdDev }, // For debugging
        }));
    }

    private buildVisualChunks(sections: VisualInsightSection[]): SemanticChunk[] {
        if (!sections.length) {
            return [];
        }

        const contextTexts = sections
            .map(section => section.contextText)
            .filter(text => Boolean(text && text.trim()));

        const embeddingDescriptions = sections
            .map(section => section.embeddingDescription || section.contextText || '')
            .filter(text => Boolean(text && text.trim()));

        const combinedText = contextTexts.join('\n\n') || embeddingDescriptions.join('\n\n');
        const combinedEmbedding = embeddingDescriptions.join('\n\n') || combinedText;
        const enrichmentHighlights = sections
            .flatMap(section => section.enrichment?.highlights ?? [])
            .filter(Boolean);
        const enrichmentQuestions = sections
            .map(section => section.enrichment?.question)
            .filter((value): value is string => Boolean(value));

        let enrichedText = combinedText;
        if (enrichmentHighlights.length || enrichmentQuestions.length) {
            const enrichmentSections: string[] = [];
            if (enrichmentHighlights.length) {
                enrichmentSections.push(`#### Visual Highlights\n- ${enrichmentHighlights.join('\n- ')}`);
            }
            if (enrichmentQuestions.length) {
                enrichmentSections.push(`#### Suggested Follow-ups\n- ${enrichmentQuestions.join('\n- ')}`);
            }
            enrichedText = [combinedText, enrichmentSections.join('\n\n')].filter(Boolean).join('\n\n');
        }

        const metadata = {
            contentType: 'visual',
            sectionCount: sections.length,
            fileNames: Array.from(new Set(sections.map(section => section.metadata.fileName).filter(Boolean))),
            pageNumbers: Array.from(
                new Set(
                    sections
                        .map(section => section.metadata.pageNumber)
                        .filter((page): page is number => typeof page === 'number')
                )
            ),
            figureTitles: sections
                .filter(section => section.metadata.type === 'figure' && section.metadata.figureTitle)
                .map(section => section.metadata.figureTitle),
            types: sections.map(section => section.metadata.type),
            highlights: enrichmentHighlights,
            questions: enrichmentQuestions,
        };

        return [
            {
                text: enrichedText,
                embeddingText: combinedEmbedding,
                index: 0,
                totalChunks: 1,
                sentenceCount: Math.max(
                    1,
                    SemanticChunkingService.splitIntoSentences(combinedText || '').length
                ),
                metadata,
            },
        ];
    }

    private buildTableChunks(structuredTables: StructuredTable[]): SemanticChunk[] {
        if (!structuredTables.length) {
            return [];
        }

        return structuredTables.map(table => {
            const trimmed = this.trimTableForChunking(table);
            const inferredInsights = this.inferTableInsights(table);

            const sharedParts: string[] = [];
            sharedParts.push('### Table Snapshot');
            sharedParts.push(table.title ? `Table Title: ${table.title}` : 'Table');
            if (table.fileName) {
                sharedParts.push(`Source File: ${table.fileName}`);
            }
            sharedParts.push(`Rows: ${Math.max(0, table.rows.length - 1)}, Columns: ${table.rows[0]?.length || 0}`);
            if (table.summary) {
                sharedParts.push(table.summary);
            }
            if (table.enrichment?.summary) {
                sharedParts.push(`Insights: ${table.enrichment.summary}`);
            }
            if (table.enrichment?.highlights?.length) {
                sharedParts.push(`Highlights:\n- ${table.enrichment.highlights.join('\n- ')}`);
            }
            if (table.enrichment?.question) {
                sharedParts.push(`Suggested Question: ${table.enrichment.question}`);
            }
            if (inferredInsights.length) {
                sharedParts.push(`Structural Inferences:\n- ${inferredInsights.join('\n- ')}`);
            }

            const fullParts = [...sharedParts];
            const fullMarkdown = this.renderMarkdownTable(trimmed.header, trimmed.rows);
            fullParts.push('#### Table Rows');
            fullParts.push(fullMarkdown);
            if (trimmed.columnTruncated) {
                fullParts.push(`_${trimmed.originalColumnCount - FileProcessingService.MAX_TABLE_COLUMNS} columns omitted._`);
            }
            const text = fullParts.filter(Boolean).join('\n\n');

            const sampleRows = trimmed.rows.slice(0, FileProcessingService.TABLE_ROWS_PER_CHUNK);
            const sampleMarkdown = this.renderMarkdownTable(trimmed.header, sampleRows);
            const embeddingParts = [...sharedParts];
            embeddingParts.push('#### Sample Rows');
            embeddingParts.push(sampleMarkdown);
            if (trimmed.rows.length > sampleRows.length) {
                embeddingParts.push(`_${trimmed.rows.length - sampleRows.length} additional rows not shown._`);
            }
            if (trimmed.columnTruncated) {
                embeddingParts.push(`_${trimmed.originalColumnCount - FileProcessingService.MAX_TABLE_COLUMNS} columns omitted._`);
            }
            const embeddingText = embeddingParts.filter(Boolean).join('\n\n');

            return {
                text,
                embeddingText,
                index: 0,
                totalChunks: 1,
                sentenceCount: Math.max(1, SemanticChunkingService.splitIntoSentences(text).length),
                metadata: {
                    contentType: 'table',
                    tableIds: [table.id],
                    tableTitles: [table.title],
                    fileNames: table.fileName ? [table.fileName] : [],
                    rowCount: trimmed.rows.length,
                    columnCount: trimmed.header.length,
                    tableChunkType: 'single',
                    inferredInsights,
                },
            } as SemanticChunk;
        });
    }

    private buildTableEmbeddingDescription(table: StructuredTable): string {
        const summaryParts: string[] = [];
        summaryParts.push(table.title ? `Table: ${table.title}` : 'Table');

        if (typeof table.pageNumber === 'number') {
            summaryParts.push(`Page ${table.pageNumber}`);
        }

        if (table.summary) {
            summaryParts.push(table.summary);
        }

        const headers = table.rows[0]?.slice(0, 5).join(', ');
        if (headers) {
            summaryParts.push(`Headers: ${headers}`);
        }

        const sampleRows = table.rows
            .slice(1, 3)
            .map(row => row.slice(0, 4).join(' | '))
            .join(' ; ');
        if (sampleRows) {
            summaryParts.push(`Sample: ${sampleRows}`);
        }

        if (table.enrichment?.summary) {
            summaryParts.push(`Insight: ${table.enrichment.summary}`);
        }

        if (table.enrichment?.highlights?.length) {
            summaryParts.push(`Highlights: ${table.enrichment.highlights.join(' | ')}`);
        }

        if (table.enrichment?.question) {
            summaryParts.push(`Question: ${table.enrichment.question}`);
        }

        const inferredInsights = this.inferTableInsights(table);
        if (inferredInsights.length) {
            summaryParts.push(`Inferred: ${inferredInsights.join(' | ')}`);
        }

        return summaryParts.join(' • ');
    }

    private trimTableForChunking(table: StructuredTable): {
        header: string[];
        rows: string[][];
        columnTruncated: boolean;
        originalColumnCount: number;
    } {
        const originalHeader = (table.rows[0] || []).map(cell => cell ?? '');
        const originalColumnCount = originalHeader.length;
        const columnTruncated = originalColumnCount > FileProcessingService.MAX_TABLE_COLUMNS;
        const header = originalHeader.slice(0, FileProcessingService.MAX_TABLE_COLUMNS);
        const rows = table.rows
            .slice(1)
            .map(row => row.map(cell => cell ?? '').slice(0, FileProcessingService.MAX_TABLE_COLUMNS));
        return {
            header,
            rows,
            columnTruncated,
            originalColumnCount,
        };
    }

    private renderMarkdownTable(header: string[], rows: string[][]): string {
        if (!header.length) {
            return rows.map(row => row.join(' | ')).join('\n');
        }
        const headerLine = `| ${header.join(' | ')} |`;
        const dividerLine = `| ${header.map(() => '---').join(' | ')} |`;
        const body = rows.map(row => `| ${row.join(' | ')} |`);
        return [headerLine, dividerLine, ...body].join('\n');
    }

    private buildTableRowGroups(rowLabels: string[], rows: string[][]): TableRowGroup[] {
        if (!rows.length) {
            return [];
        }

        const normalizedLabels = rowLabels.map(label => (label || '').toLowerCase());

        const monthGroups = this.groupRowsByDefinitions(
            normalizedLabels,
            rows,
            FileProcessingService.MONTH_DEFINITIONS,
            'Month'
        );
        if (monthGroups) {
            return monthGroups;
        }

        const quarterGroups = this.groupRowsByDefinitions(
            normalizedLabels,
            rows,
            FileProcessingService.QUARTER_DEFINITIONS,
            'Quarter'
        );
        if (quarterGroups) {
            return quarterGroups;
        }

        const regionGroups = this.groupRowsByDefinitions(
            normalizedLabels,
            rows,
            FileProcessingService.REGION_DEFINITIONS,
            'Region'
        );
        if (regionGroups) {
            return regionGroups;
        }

        const departmentGroups = this.groupRowsByDefinitions(
            normalizedLabels,
            rows,
            FileProcessingService.DEPARTMENT_DEFINITIONS,
            'Department'
        );
        if (departmentGroups) {
            return departmentGroups;
        }

        return this.chunkRowsSequentially(rows);
    }

    private groupRowsByDefinitions(
        normalizedLabels: string[],
        rows: string[][],
        definitions: { canonical: string; patterns: string[] }[],
        prefix: string
    ): TableRowGroup[] | null {
        const grouped = new Map<string, string[][]>();
        const matchedIndexes = new Set<number>();

        normalizedLabels.forEach((label, idx) => {
            for (const def of definitions) {
                if (def.patterns.some(pattern => label.includes(pattern))) {
                    const key = `${prefix}: ${def.canonical}`;
                    if (!grouped.has(key)) {
                        grouped.set(key, []);
                    }
                    grouped.get(key)?.push(rows[idx]);
                    matchedIndexes.add(idx);
                    return;
                }
            }
        });

        const groups: TableRowGroup[] = Array.from(grouped.entries()).map(([label, groupRows]) => ({
            label,
            rows: groupRows,
        }));
        const coverage = rows.length ? matchedIndexes.size / rows.length : 0;
        if (groups.length >= 2 && coverage >= 0.5) {
            return groups;
        }

        return null;
    }

    private chunkRowsSequentially(rows: string[][]): TableRowGroup[] {
        const groups: TableRowGroup[] = [];
        for (let i = 0; i < rows.length; i += FileProcessingService.TABLE_ROWS_PER_CHUNK) {
            const chunkRows = rows.slice(i, i + FileProcessingService.TABLE_ROWS_PER_CHUNK);
            const label = `Rows ${i + 1} - ${i + chunkRows.length}`;
            groups.push({ label, rows: chunkRows });
        }
        return groups;
    }

    private limitTableGroups(groups: TableRowGroup[]): LimitedTableRowGroup[] {
        if (groups.length <= FileProcessingService.MAX_TABLE_DATA_CHUNKS) {
            return groups;
        }
        const allowed = FileProcessingService.MAX_TABLE_DATA_CHUNKS - 1;
        const limited: LimitedTableRowGroup[] = groups.slice(0, allowed);
        const remainingRows = groups.slice(allowed).flatMap(group => group.rows);
        if (remainingRows.length) {
            const sampleRows = remainingRows.slice(0, FileProcessingService.TABLE_ROWS_PER_CHUNK);
            limited.push({
                label: `Additional Rows`,
                rows: sampleRows,
                truncatedRows: remainingRows.length - sampleRows.length,
            });
        }
        return limited;
    }

    private buildPowerPointChunks(slides: PowerPointSlide[], fileName: string): SemanticChunk[] {
        if (!slides.length) {
            return [];
        }

        return slides.map(slide => {
            const slideNumber = typeof slide.index === 'number' ? slide.index + 1 : undefined;
            const slideTitle = slide.title ? `: ${slide.title}` : '';
            const header = [
                slideNumber ? `### Slide ${slideNumber}${slideTitle}` : `### Slide${slideTitle}`,
                `Source File: ${fileName}`,
            ]
                .filter(Boolean)
                .join('\n\n');
            const chunkText = [header, slide.text].filter(Boolean).join('\n\n');
            return {
                text: chunkText,
                embeddingText: chunkText,
                index: 0,
                totalChunks: 1,
                sentenceCount: Math.max(1, SemanticChunkingService.splitIntoSentences(slide.text || '').length),
                metadata: {
                    contentType: 'presentation',
                    slideNumber,
                    fileName,
                },
            };
        });
    }

    private buildEmbeddingPayload(chunk: SemanticChunk, fileName?: string): string {
        const sections: string[] = [];
        if (fileName) {
            sections.push(`File: ${fileName}`);
        }

        const metadata = (chunk.metadata || {}) as Record<string, unknown>;
        const contentType =
            typeof metadata.contentType === 'string' ? (metadata.contentType as string) : undefined;
        switch (contentType) {
            case 'table': {
                const tableTitles = Array.isArray(metadata.tableTitles)
                    ? metadata.tableTitles.filter(title => typeof title === 'string' && title.trim().length > 0)
                    : [];
                if (tableTitles.length) {
                    sections.push(`Table Context: ${tableTitles.join(' | ')}`);
                }
                const tableChunkIndex =
                    typeof metadata.tableChunkIndex === 'number' ? (metadata.tableChunkIndex as number) : undefined;
                const tableChunkTotal =
                    typeof metadata.tableChunkTotal === 'number' ? (metadata.tableChunkTotal as number) : undefined;
                if (tableChunkIndex !== undefined && tableChunkTotal !== undefined) {
                    sections.push(`Table Chunk: ${tableChunkIndex + 1}/${tableChunkTotal}`);
                }
                if (typeof metadata.tableGroupLabel === 'string' && metadata.tableGroupLabel.trim().length > 0) {
                    sections.push(`Group: ${metadata.tableGroupLabel}`);
                }
                if (typeof metadata.tableGroupTruncated === 'number' && metadata.tableGroupTruncated > 0) {
                    sections.push(`Additional Rows Not Shown: ${metadata.tableGroupTruncated}`);
                }
                break;
            }
            case 'presentation': {
                const slideNumber =
                    typeof metadata.slideNumber === 'number' ? (metadata.slideNumber as number) : undefined;
                if (slideNumber !== undefined) {
                    sections.push(`Slide Number: ${slideNumber}`);
                }
                break;
            }
            case 'visual': {
                const pageNumbers = Array.isArray(metadata.pageNumbers)
                    ? metadata.pageNumbers.filter(page => typeof page === 'number') as number[]
                    : [];
                if (pageNumbers.length) {
                    sections.push(`Pages: ${pageNumbers.join(', ')}`);
                }
                break;
            }
            default:
                break;
        }

        const baseText = chunk.embeddingText || chunk.text || '';
        sections.push(baseText);
        return sections.filter(Boolean).join('\n\n');
    }

    private inferTableInsights(table: StructuredTable): string[] {
        if (!table.rows.length) {
            return [];
        }

        const headers = table.rows[0] || [];
        const rowLabels = table.rows
            .slice(1)
            .map(row => (row?.[0] || '').trim())
            .filter(Boolean);
        const normalizedRowLabels = rowLabels.map(label => label.toLowerCase());
        const normalizedHeaders = headers.map(cell => (cell || '').toLowerCase());
        const normalizedTitle = (table.title || '').toLowerCase();
        const searchableText = [normalizedTitle, ...normalizedHeaders, ...normalizedRowLabels].join(' ');
        const insights: string[] = [];
        const seen = new Set<string>();
        const addInsight = (message: string): void => {
            if (message && !seen.has(message)) {
                seen.add(message);
                insights.push(message);
            }
        };
        const formatExamples = (items: string[], limit = 3): string => {
            if (!items.length) {
                return '';
            }
            const preview = items.slice(0, limit).join(', ');
            return items.length > limit ? `${preview}, ...` : preview;
        };

        const monthsDetected = FileProcessingService.MONTH_DEFINITIONS
            .filter(month => normalizedRowLabels.some(label => month.patterns.some(pattern => label.includes(pattern))))
            .map(month => month.canonical);
        if (monthsDetected.length >= 3) {
            addInsight(
                `Row labels list calendar months (${formatExamples(monthsDetected)}), suggesting a monthly timeline or forecast.`
            );
        }

        const quarterMatches = FileProcessingService.QUARTER_DEFINITIONS
            .filter(def => normalizedRowLabels.some(label => def.patterns.some(pattern => label.includes(pattern))))
            .map(def => def.canonical);
        if (quarterMatches.length >= 2) {
            addInsight(
                `Rows reference multiple business quarters (${formatExamples(quarterMatches)}), so the table likely compares quarterly performance.`
            );
        }

        const yearMatches = new Set<string>();
        const yearRegex = /\b(19|20)\d{2}\b/g;
        [table.title || '', ...headers, ...rowLabels].forEach(value => {
            if (!value) {
                return;
            }
            const matches = value.match(yearRegex);
            if (matches) {
                matches.forEach(year => yearMatches.add(year));
            }
        });
        if (yearMatches.size >= 2) {
            addInsight(
                `Headers mention multiple years (${formatExamples(Array.from(yearMatches))}), indicating a year-over-year comparison.`
            );
        }

        const regionMatches = FileProcessingService.REGION_DEFINITIONS
            .filter(region => normalizedRowLabels.some(label => region.patterns.some(pattern => label.includes(pattern))))
            .map(region => region.canonical);
        if (regionMatches.length >= 2) {
            addInsight(
                `Row labels mention multiple regions (${formatExamples(regionMatches)}), so the table likely splits metrics by geography.`
            );
        }

        const departmentMatches = FileProcessingService.DEPARTMENT_DEFINITIONS
            .filter(dept => normalizedRowLabels.some(label => dept.patterns.some(pattern => label.includes(pattern))))
            .map(dept => dept.canonical);
        if (departmentMatches.length >= 3) {
            addInsight(
                `Multiple functional teams appear in the first column (${formatExamples(departmentMatches)}), pointing to department-level reporting.`
            );
        }

        const metricThemes = [
            {
                keywords: ['revenue', 'sales', 'turnover', 'arr', 'mrr', 'booking'],
                message: 'Title and headers highlight revenue or sales metrics.',
            },
            {
                keywords: ['cost', 'expense', 'spend', 'opex', 'capex'],
                message: 'Content references cost or expense tracking.',
            },
            {
                keywords: ['profit', 'margin', 'ebitda'],
                message: 'Financial profitability indicators are mentioned.',
            },
            {
                keywords: ['headcount', 'employee', 'staff', 'fte', 'hiring'],
                message: 'Data appears to focus on workforce or staffing trends.',
            },
            {
                keywords: ['conversion', 'funnel', 'lead', 'mql', 'sql', 'pipeline'],
                message: 'Marketing or sales funnel stages are referenced.',
            },
            {
                keywords: ['churn', 'retention', 'renewal'],
                message: 'Customer retention metrics are present.',
            },
            {
                keywords: ['inventory', 'stock', 'warehouse', 'sku', 'supply'],
                message: 'Operations or inventory levels are likely tracked.',
            },
            {
                keywords: ['nps', 'satisfaction', 'csat', 'ticket', 'support'],
                message: 'Customer satisfaction or support KPIs appear in the structure.',
            },
        ];
        metricThemes.forEach(theme => {
            if (theme.keywords.some(keyword => searchableText.includes(keyword))) {
                addInsight(theme.message);
            }
        });

        const scenarioKeywords = ['plan', 'forecast', 'target', 'actual', 'variance', 'budget'];
        const scenarioMatches = scenarioKeywords.filter(keyword => searchableText.includes(keyword));
        if (scenarioMatches.length >= 2) {
            addInsight('Columns mention plan vs. actual style terminology, suggesting scenario or variance analysis.');
        }

        const summaryRowLabels = rowLabels.filter(label => /\b(total|average|avg|overall|sum)\b/i.test(label));
        if (summaryRowLabels.length) {
            addInsight(
                `Summary rows such as ${formatExamples(summaryRowLabels)} indicate the table aggregates metrics at the bottom.`
            );
        }

        const hasPercentages = table.rows.some(row =>
            row.some(cell => typeof cell === 'string' && cell.includes('%'))
        );
        if (hasPercentages) {
            addInsight('Percentage values appear in the cells, so part of the table likely shows share or rate metrics.');
        }

        const currencyRegex = /[\u0024\u00a3\u20ac]/;
        const hasCurrency = table.rows.some(row =>
            row.some(cell => typeof cell === 'string' && currencyRegex.test(cell))
        );
        if (hasCurrency) {
            addInsight('Currency symbols are present, implying monetary figures or pricing information.');
        }

        return insights;
    }

    private async enrichStructuredTables(tables: StructuredTable[], _provider: string): Promise<StructuredTable[]> {
        if (!tables.length || !config.ragOptimization.assetEnrichment.tables.enabled) {
            return tables;
        }

        const promptTemplate = config.ragOptimization.assetEnrichment.tables.promptTemplate;
        const maxTokens = config.ragOptimization.assetEnrichment.tables.maxTokens;

        return Promise.all(
            tables.map(async table => {
                try {
                    const condensedRows = table.rows
                        .slice(0, 5)
                        .map(row => row.slice(0, 5));
                    const preview = condensedRows.map(row => row.join(' | ')).join('\n');
                    const prompt = promptTemplate
                        .replace('{{TITLE}}', table.title || 'Table')
                        .replace('{{SUMMARY}}', table.summary || '')
                        .replace('{{ROWS}}', preview || '');

                    const response = await llmService.generateResponse(
                        'openai',
                        'gpt-4o-mini',
                        [
                            {
                                role: 'user',
                                content: prompt,
                            },
                        ],
                        'Return only the JSON payload. Do not include explanations.',
                        0.2,
                        maxTokens
                    );

                    const parsed = this.safeJsonParse(response.content);
                    if (parsed) {
                        return {
                            ...table,
                            enrichment: {
                                summary: typeof parsed.summary === 'string' ? parsed.summary : table.summary,
                                highlights: Array.isArray(parsed.highlights)
                                    ? parsed.highlights.filter((item: unknown): item is string => typeof item === 'string')
                                    : undefined,
                                question: typeof parsed.question === 'string' ? parsed.question : undefined,
                            },
                        };
                    }
                } catch (error) {
                    logger.warn('Table enrichment failed', { tableId: table.id, error });
                }
                return table;
            })
        );
    }

    private reindexChunks(chunks: SemanticChunk[]): SemanticChunk[] {
        return chunks.map((chunk, index) => ({
            ...chunk,
            index,
            totalChunks: chunks.length,
            metadata: {
                ...chunk.metadata,
                chunkRank: index,
                chunkTotal: chunks.length,
            },
        }));
    }

    private safeJsonParse(text: string | null | undefined): Record<string, unknown> | null {
        if (!text) {
            return null;
        }
        try {
            return JSON.parse(text);
        } catch {
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1 && end > start) {
                try {
                    return JSON.parse(text.slice(start, end + 1));
                } catch {
                    return null;
                }
            }
            return null;
        }
    }

    /**
     * Delete file and all its chunks from knowledge base
     */
    async deleteFileFromKnowledgeBase(kbId: string, entryId: string): Promise<{ success: boolean; deletedChunks: number }> {
        try {
            // Find the parent entry (chunk_index = 0) or use provided entry
            const parentQuery = await db.query(
                `SELECT id, parent_entry_id, chunk_index
         FROM knowledge_base
         WHERE id = $1 AND kb_id = $2`,
                [entryId, kbId]
            );

            if (parentQuery.rows.length === 0) {
                throw new Error('Entry not found');
            }

            const entry = parentQuery.rows[0];
            const parentId = entry.chunk_index === 0 ? entry.id : entry.parent_entry_id;

            // Delete parent and all children
            const deleteResult = await db.query(
                `DELETE FROM knowledge_base
         WHERE kb_id = $1 AND (id = $2 OR parent_entry_id = $2)
         RETURNING id`,
                [kbId, parentId]
            );

            logger.info(`Deleted ${deleteResult.rows.length} chunks for entry ${parentId}`);

            return {
                success: true,
                deletedChunks: deleteResult.rows.length,
            };
        } catch (error) {
            logger.error('Delete file error:', error);
            throw error;
        }
    }

    /**
     * List all uploaded files for a twin
     */
    async listFilesForTwin(kbId: string): Promise<KnowledgeFile[]> {
        try {
            const result = await db.query<KnowledgeFile>(
                `SELECT DISTINCT ON (file_name)
          id,
          file_name,
          file_size,
          file_type,
          total_chunks,
          created_at
        FROM knowledge_base
        WHERE kb_id = $1 AND file_name IS NOT NULL AND chunk_index = 0
        ORDER BY file_name, created_at DESC`,
                [kbId]
            );

            return result.rows;
        } catch (error) {
            logger.error('List files error:', error);
            throw error;
        }
    }
    private async validateTablesWithLLM(tables: StructuredTable[], provider: string): Promise<StructuredTable[]> {
        if (!tables.length || !config.visualExtraction?.enabled) {
            return tables;
        }

        try {
            const summaries = await Promise.all(tables.map(table => this.describeTable(table, provider)));

            return tables.map((table, index) => ({
                ...table,
                validation: summaries[index]?.validation || { status: 'skipped' },
                summary: summaries[index]?.summary || table.summary,
            }));
        } catch (error) {
            logger.warn('Table validation failed, continuing without validation', { error });
            return tables;
        }
    }

    private async describeTable(table: StructuredTable, provider: string): Promise<{ summary?: string; validation?: StructuredTable['validation'] }> {
        try {
            const rowsPreview = table.rows.slice(0, 10);
            const markdown = structuredTableExtractionService.renderMarkdown({
                ...table,
                rows: rowsPreview,
            });

            const prompt = [
                'You are a data quality assistant verifying table extractions.',
                'Read the markdown table below and respond in JSON with:',
                '{ "summary": "...", "confidence": 0-1, "status": "passed|failed" }',
                '',
                markdown,
            ].join('\n');

            const response = await llmService.generateResponse(
                provider === 'anthropic' ? 'anthropic' : 'openai',
                provider === 'anthropic' ? 'claude-3-haiku-20240307' : 'gpt-4o-mini',
                [
                    { role: 'user', content: prompt },
                ],
                'You must return JSON.',
                0,
                200
            );

            const parsed = this.safeJsonParse(response.content);
            if (!parsed) {
                return {
                    summary: table.summary,
                    validation: { status: 'failed', message: 'LLM response unparsable' },
                };
            }

            return {
                summary: typeof parsed.summary === 'string' ? parsed.summary : table.summary,
                validation: {
                    status: parsed.status === 'passed' ? 'passed' : 'failed',
                    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : undefined,
                    message: typeof parsed.message === 'string' ? parsed.message : undefined,
                },
            };
        } catch (error) {
            return {
                summary: table.summary,
                validation: { status: 'failed', message: (error as Error).message },
            };
        }
    }
}

export default new FileProcessingService();
