import config from '../config/appConfig';
import LLMService from './llmService';
import logger from '../config/logger';
import ChunkingService from './chunkingService';
import contextualEnrichmentService from './contextualEnrichmentService';

interface SemanticChunkingOptions {
    maxTokens?: number;
    similarityThreshold?: number;
    minChunkSize?: number;
    overlapPercentage?: number;
    provider?: string;
    useContextualEnrichment?: boolean;
    maxDocumentTokens?: number;
}

export interface SemanticChunk {
    text: string;
    embeddingText?: string;
    index: number;
    totalChunks: number;
    sentenceCount: number;
    startSentence?: number;
    endSentence?: number;
    hasOverlap?: boolean;
    overlapAdded?: boolean;
    metadata?: Record<string, unknown>;
    hasContext?: boolean;
    context?: string | null;
    enrichedText?: string;
    enrichmentError?: string;
    [key: string]: unknown;
}

class SemanticChunkingService {
    /**
     * Calculate cosine similarity between two embedding vectors
     */
    cosineSimilarity(vecA: number[], vecB: number[]): number {
        if (vecA.length !== vecB.length) {
            throw new Error('Vectors must have the same length');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (normA * normB);
    }

    /**
     * Estimate the number of tokens in a text string
     * Uses rough approximation: ~4 characters per token
     */
    estimateTokens(text: string): number {
        if (!text || text.length === 0) {
            return 0;
        }
        return Math.ceil(text.length / config.chunking.charactersPerToken);
    }

    /**
     * Split text into sentences using multiple delimiters
     * Handles common sentence endings: . ! ? with proper spacing
     */
    splitIntoSentences(text: string): string[] {
        if (!text || text.length === 0) {
            return [];
        }

        // Enhanced regex to handle:
        // - Period, exclamation, question marks
        // - Followed by space or newline or end of string
        // - Handles common abbreviations (Dr., Mr., Mrs., etc.)
        const sentenceRegex = /(?<![A-Z])(?<!\b(?:Dr|Mr|Mrs|Ms|Prof|Sr|Jr|vs|etc|Inc|Ltd|Corp))\.(?=\s+[A-Z]|\s*$)|[!?]+(?=\s+|$)/g;

        // Split and clean sentences
        const sentences = text
            .split(sentenceRegex)
            .map(s => s.trim())
            .filter(s => s.length > 0);

        // If regex splitting fails, fallback to simple split
        if (sentences.length === 0) {
            return text
                .split(/[.!?]+/)
                .map(s => s.trim())
                .filter(s => s.length > 0);
        }

        return sentences;
    }

    /**
     * Group sentences into chunks based on semantic similarity
     */
    async semanticChunkText(text: string, options: SemanticChunkingOptions = {}): Promise<SemanticChunk[]> {
        const {
            maxTokens = config.semanticChunking.maxTokensPerChunk,
            similarityThreshold = config.semanticChunking.similarityThreshold,
            minChunkSize = config.semanticChunking.minChunkSize,
            provider = 'openai',
        } = options;

        if (!text || text.length === 0) {
            return [];
        }

        // Split into sentences
        const sentences = this.splitIntoSentences(text);

        // If only one sentence or very short, return as single chunk
        if (sentences.length === 0) {
            return [];
        }

        if (sentences.length === 1) {
            return [
                {
                    text: sentences[0],
                    embeddingText: sentences[0],
                    index: 0,
                    totalChunks: 1,
                    sentenceCount: 1,
                },
            ];
        }

        // Generate embeddings for all sentences
        // Using batch to reduce API calls
        const embeddings = await LLMService.generateBatchEmbeddings(
            sentences,
            provider
        );

        // Calculate similarities between consecutive sentences
        const similarities: number[] = [];
        for (let i = 0; i < embeddings.length - 1; i++) {
            const currentEmbedding = embeddings[i];
            const nextEmbedding = embeddings[i + 1];
            if (!currentEmbedding || !nextEmbedding) {
                continue;
            }
            const similarity = this.cosineSimilarity(currentEmbedding, nextEmbedding);
            similarities.push(similarity);
        }

        // Identify chunk boundaries where similarity drops
        const chunkBoundaries = [0]; // Start with first sentence
        let currentChunkTokens = this.estimateTokens(sentences[0]);

        // Check if first sentence already exceeds maxTokens
        if (currentChunkTokens > maxTokens) {
            logger.warn(
                `First sentence exceeds maxTokens (${currentChunkTokens} > ${maxTokens}). ` +
                `Consider using character-based chunking for this document.`
            );
        }

        for (let i = 0; i < similarities.length; i++) {
            const sentenceTokens = this.estimateTokens(sentences[i + 1]);

            // Warn if a single sentence exceeds maxTokens
            if (sentenceTokens > maxTokens) {
                logger.warn(
                    `Sentence at index ${i + 1} exceeds maxTokens (${sentenceTokens} > ${maxTokens}). ` +
                    `It will be placed in its own chunk.`
                );
            }

            // Create boundary if:
            // 1. Similarity drops below threshold (topic change)
            // 2. OR adding next sentence would exceed max tokens
            // 3. OR current sentence alone exceeds max tokens (force boundary)
            const shouldCreateBoundary =
                similarities[i] < similarityThreshold ||
                currentChunkTokens + sentenceTokens > maxTokens ||
                sentenceTokens > maxTokens;

            if (shouldCreateBoundary && currentChunkTokens >= minChunkSize) {
                chunkBoundaries.push(i + 1);
                currentChunkTokens = sentenceTokens;
            } else {
                currentChunkTokens += sentenceTokens;
            }
        }

        // Add final boundary
        if (chunkBoundaries[chunkBoundaries.length - 1] !== sentences.length) {
            chunkBoundaries.push(sentences.length);
        }

        // Create chunks from boundaries
        const chunks: SemanticChunk[] = [];
        for (let i = 0; i < chunkBoundaries.length - 1; i++) {
            const start = chunkBoundaries[i];
            const end = chunkBoundaries[i + 1];
            const chunkSentences = sentences.slice(start, end);
            const chunkText = chunkSentences.join(' ');

            chunks.push({
                text: chunkText,
                embeddingText: chunkText,
                index: i,
                totalChunks: chunkBoundaries.length - 1,
                sentenceCount: chunkSentences.length,
                startSentence: start,
                endSentence: end,
            });
        }

        return chunks;
    }

    /**
     * Add intelligent overlap between chunks
     * Overlap is added at sentence boundaries to preserve context
     */
    addOverlap(chunks: SemanticChunk[], sentences: string[], overlapPercentage = 0.2): SemanticChunk[] {
        if (chunks.length === 0) {
            return chunks;
        }

        // If only one chunk or no overlap, still add hasOverlap property
        if (chunks.length === 1 || overlapPercentage === 0) {
            return chunks.map((chunk) => ({
                ...chunk,
                hasOverlap: false,
                overlapAdded: false,
            }));
        }

        const chunksWithOverlap: SemanticChunk[] = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            let overlapText = '';

            // Add overlap from previous chunk (for all chunks except first)
            if (i > 0) {
                const prevChunk = chunks[i - 1];
                const prevSentences = sentences.slice(
                    prevChunk.startSentence!,
                    prevChunk.endSentence!
                );

                // Calculate how many sentences to overlap
                const overlapSentenceCount = Math.max(
                    1,
                    Math.floor(prevSentences.length * overlapPercentage)
                );

                // Take last N sentences from previous chunk
                const overlapSentences = prevSentences.slice(-overlapSentenceCount);
                overlapText = overlapSentences.join(' ') + ' ';
            }

            chunksWithOverlap.push({
                ...chunk,
                text: overlapText + chunk.text,
                embeddingText: chunk.embeddingText || chunk.text,
                hasOverlap: i > 0,
                overlapAdded: overlapText.length > 0,
            });
        }

        return chunksWithOverlap;
    }

    /**
     * Main method: Chunk a document using semantic chunking with overlap
     */
    async chunkDocument(content: string, metadata: Record<string, unknown> = {}, options: SemanticChunkingOptions = {}): Promise<SemanticChunk[]> {
        const {
            overlapPercentage = config.semanticChunking.overlapPercentage,
            useContextualEnrichment = config.ragOptimization.contextualEnrichment.enabled,
        } = options;

        if (!content || content.length === 0) {
            return [];
        }

        // Step 1: Split into sentences
        const sentences = this.splitIntoSentences(content);

        if (sentences.length === 0) {
            return [];
        }

        // Step 2: Create semantic chunks
        const chunks = await this.semanticChunkText(content, options);

        if (chunks.length === 0) {
            return [];
        }

        // Step 3: Add intelligent overlap
        const chunksWithOverlap = this.addOverlap(
            chunks,
            sentences,
            overlapPercentage
        );

        // Step 4: Apply contextual enrichment (Anthropic technique) if enabled
        let finalChunks = chunksWithOverlap;

        if (useContextualEnrichment && contextualEnrichmentService.isEnrichmentEnabled()) {
            try {
                logger.info('Applying contextual enrichment to chunks', {
                    chunkCount: chunksWithOverlap.length,
                    documentLength: content.length,
                });

                const enrichedChunks = await contextualEnrichmentService.enrichChunks(
                    content,
                    chunksWithOverlap,
                    {
                        fallbackOnError: true,
                        delayBetweenCalls: 200, // Rate limiting
                    }
                );

                finalChunks = enrichedChunks;

                logger.info('Contextual enrichment completed', {
                    totalChunks: enrichedChunks.length,
                    enrichedChunks: enrichedChunks.filter((c: { hasContext?: boolean }) => c.hasContext).length,
                });
            } catch (error) {
                logger.error('Contextual enrichment failed, using original chunks:', error);
                // Continue with non-enriched chunks
            }
        }

        // Step 5: Attach metadata
        return finalChunks.map(chunk => ({
            ...chunk,
            metadata: {
                ...metadata,
                chunkingMethod: 'semantic',
                overlapPercentage,
                contextuallyEnriched: chunk.hasContext || false,
            },
        }));
    }

    /**
     * Fallback to recursive character chunking if semantic fails
     * (e.g., API errors, very large documents)
     */
    async chunkDocumentWithFallback(content: string, metadata: Record<string, unknown> = {}, options: SemanticChunkingOptions = {}): Promise<SemanticChunk[]> {
        const fallbackToCharacterChunks = (): SemanticChunk[] => {
            const maxTokens = options.maxTokens || config.semanticChunking.maxTokensPerChunk;
            const overlapPercentage = options.overlapPercentage ?? config.semanticChunking.overlapPercentage;

            const chunkingServiceOptions = {
                maxTokens,
                overlap: Math.floor(maxTokens * overlapPercentage),
            };

            const fallbackChunks = ChunkingService.chunkDocument(content, metadata, chunkingServiceOptions);
            return fallbackChunks.map(chunk => ({
                text: chunk.text,
                embeddingText: chunk.text,
                index: chunk.index,
                totalChunks: chunk.totalChunks,
                sentenceCount: this.splitIntoSentences(chunk.text).length,
                metadata: chunk.metadata,
            }));
        };

        const totalTokens = this.estimateTokens(content);
        const maxDocumentTokens = options.maxDocumentTokens ?? config.semanticChunking.maxDocumentTokens;

        if (maxDocumentTokens && totalTokens > maxDocumentTokens) {
            logger.warn('Semantic chunking skipped due to oversized document', {
                totalTokens,
                maxDocumentTokens,
                metadata,
            });
            return fallbackToCharacterChunks();
        }

        try {
            return await this.chunkDocument(content, metadata, options);
        } catch (error) {
            // Check if it's a retryable error (rate limit or server error)
            const normalizedError = error as { status?: number; message?: string };
            const status = normalizedError.status;
            const isRetryable = status === 429 || (typeof status === 'number' && status >= 500 && status < 600);

            if (isRetryable) {
                logger.warn('Retryable error in semantic chunking, attempting once more...', {
                    status,
                    message: (error as Error).message,
                });

                // Wait 2 seconds before retrying
                await new Promise(resolve => setTimeout(resolve, 2000));

                try {
                    return await this.chunkDocument(content, metadata, options);
                } catch (retryError) {
                    logger.error('Retry failed, using character-based fallback', {
                        error: (retryError as Error).message,
                    });
                }
            } else {
                logger.error('Semantic chunking failed, falling back to character-based:', {
                    error: (error as Error).message,
                });
            }

            return fallbackToCharacterChunks();
        }
    }
}

export default new SemanticChunkingService();
