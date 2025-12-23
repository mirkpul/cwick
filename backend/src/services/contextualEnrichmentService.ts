import config from '../config/appConfig';
import logger from '../config/logger';
import llmService, { LLMProvider } from './llmService';

interface ChunkContextOptions {
    provider?: LLMProvider;
    model?: string;
    maxContextLength?: number;
    maxDocumentLength?: number;
    fallbackOnError?: boolean;
    delayBetweenCalls?: number;
}

interface Chunk {
    text: string;
    index: number;
    [key: string]: unknown;
}

type EnrichedChunk<T extends Chunk = Chunk> = T & {
    context: string | null;
    enrichedText: string;
    hasContext: boolean;
    enrichmentError?: string;
};

/**
 * Contextual Enrichment Service
 *
 * Implements Anthropic's Contextual Retrieval technique:
 * Generates contextual information for document chunks using an LLM,
 * then prepends this context to improve embedding quality and retrieval accuracy.
 */
class ContextualEnrichmentService {
    /**
     * Generate contextual information for a chunk
     */
    async generateChunkContext(
        document: string,
        chunk: string,
        options: ChunkContextOptions = {}
    ): Promise<string> {
        const {
            provider = 'openai',
            model = 'gpt-4o-mini',
            maxContextLength = config.ragOptimization.contextualEnrichment.maxContextLength,
            maxDocumentLength = 8000,
        } = options;

        try {
            // Truncate document if too long to avoid token limits
            let truncatedDoc = document;
            if (document.length > maxDocumentLength) {
                truncatedDoc = document.substring(0, maxDocumentLength) + '...';
                logger.debug('Document truncated for context generation', {
                    originalLength: document.length,
                    truncatedLength: truncatedDoc.length,
                });
            }

            // Create prompt using template
            const systemPrompt = this.createContextPrompt(truncatedDoc, chunk);

            // Generate context using LLM
            logger.debug('Generating chunk context', {
                provider,
                model,
                chunkLength: chunk.length,
                documentLength: truncatedDoc.length,
            });

            const response = await llmService.generateResponse(
                provider,
                model,
                [], // No conversation history
                systemPrompt,
                0.3, // Low temperature for consistent output
                150 // Short context
            );

            let context = response.content.trim();

            // Truncate if exceeds max length
            if (context.length > maxContextLength) {
                context = this.truncateContext(context, maxContextLength);
            }

            logger.debug('Chunk context generated', {
                contextLength: context.length,
                contextPreview: context.substring(0, 100),
            });

            return context;
        } catch (error) {
            logger.error('Failed to generate chunk context:', error);
            throw error;
        }
    }

    /**
     * Enrich a single chunk with generated context
     */
    async enrichChunk(
        document: string,
        chunk: string,
        options: ChunkContextOptions = {}
    ): Promise<string> {
        const { fallbackOnError = true } = options;

        try {
            const context = await this.generateChunkContext(document, chunk, options);

            // Prepend context to chunk
            const enrichedChunk = `${context}\n\n${chunk}`;

            return enrichedChunk;
        } catch (error) {
            logger.error('Failed to enrich chunk:', error);

            if (fallbackOnError) {
                logger.warn('Falling back to original chunk without context');
                return chunk;
            }

            throw error;
        }
    }

    /**
     * Enrich multiple chunks with context (batch processing)
     */
    async enrichChunks<TChunk extends Chunk>(
        document: string,
        chunks: TChunk[],
        options: ChunkContextOptions = {}
    ): Promise<EnrichedChunk<TChunk>[]> {
        const { delayBetweenCalls = 200, fallbackOnError = true } = options;

        if (!chunks || chunks.length === 0) {
            return [];
        }

        const enrichedChunks: EnrichedChunk<TChunk>[] = [];

        logger.info(`Enriching ${chunks.length} chunks with contextual information`);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            try {
                const context = await this.generateChunkContext(
                    document,
                    chunk.text,
                    options
                );

                const enrichedText = `${context}\n\n${chunk.text}`;

                enrichedChunks.push({
                    ...chunk,
                    context,
                    enrichedText,
                    hasContext: true,
                } as EnrichedChunk<TChunk>);

                logger.debug(`Chunk ${i + 1}/${chunks.length} enriched`, {
                    chunkIndex: chunk.index,
                    contextLength: context.length,
                });

                // Add delay between calls to avoid rate limits (except for last chunk)
                if (i < chunks.length - 1 && delayBetweenCalls > 0) {
                    await this.sleep(delayBetweenCalls);
                }
            } catch (error) {
                logger.error(`Failed to enrich chunk ${i + 1}:`, error);

                if (fallbackOnError) {
                    // Add chunk without context
                    enrichedChunks.push({
                        ...chunk,
                        context: null,
                        enrichedText: chunk.text,
                        hasContext: false,
                        enrichmentError: (error as Error).message,
                    } as EnrichedChunk<TChunk>);
                } else {
                    throw error;
                }
            }
        }

        const successCount = enrichedChunks.filter((c) => c.hasContext).length;
        logger.info(
            `Enriched ${successCount}/${chunks.length} chunks successfully`
        );

        return enrichedChunks;
    }

    /**
     * Create context generation prompt from template
     */
    createContextPrompt(document: string, chunk: string): string {
        const template = config.ragOptimization.contextualEnrichment.contextPromptTemplate;

        return template
            .replace('{{DOCUMENT}}', document)
            .replace('{{CHUNK}}', chunk);
    }

    /**
     * Truncate context to maximum length
     */
    truncateContext(context: string, maxLength: number): string {
        if (!context || context.length <= maxLength) {
            return context;
        }

        return context.substring(0, maxLength - 3) + '...';
    }

    /**
     * Check if contextual enrichment is enabled in config
     */
    isEnrichmentEnabled(): boolean {
        return (
            config.ragOptimization.contextualEnrichment.enabled &&
            config.ragOptimization.contextualEnrichment.useContextGeneration
        );
    }

    /**
     * Sleep helper for rate limiting
     */
    sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

export default new ContextualEnrichmentService();
