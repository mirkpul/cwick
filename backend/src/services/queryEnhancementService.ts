import config from '../config/appConfig';
import logger from '../config/logger';
import llmService, { LLMProvider } from './llmService';

interface EnhancementOptions {
    provider?: LLMProvider;
    model?: string;
    temperature?: number;
    count?: number;
    maxHistoryMessages?: number;
    fallbackToOriginal?: boolean;
    fallbackOnError?: boolean;
    useContextInjection?: boolean;
    useHyDE?: boolean;
    useMultiQuery?: boolean;
}

interface ConversationMessage {
    sender: string;
    content: string;
    [key: string]: unknown;
}

export interface EnhancedQueryResult {
    originalQuery: string;
    enhancedQuery: string;
    hydeDocument: string | null;
    queryVariants: string[];
}

/**
 * Query Enhancement Service
 *
 * Implements advanced query optimization techniques for better RAG retrieval:
 * 1. HyDE (Hypothetical Document Embeddings) - Generate hypothetical answer to embed
 * 2. Multi-Query Expansion - Generate multiple query variations
 * 3. Conversation Context Injection - Make queries standalone with history
 */
class QueryEnhancementService {
    /**
     * Generate hypothetical document using HyDE technique
     */
    async generateHyDE(query: string, options: EnhancementOptions = {}): Promise<string> {
        const {
            provider = 'openai',
            model = 'gpt-4o-mini',
            temperature = 0.7,
        } = options;

        try {
            const prompt = config.ragOptimization.queryEnhancement.hydePromptTemplate
                .replace('{{QUERY}}', query);

            logger.debug('Generating HyDE document', {
                query,
                provider,
                model,
            });

            const response = await llmService.generateResponse(
                provider,
                model,
                [],
                prompt,
                temperature,
                300
            );

            const hydeDocument = response.content.trim();

            logger.debug('HyDE document generated', {
                queryLength: query.length,
                hydeLength: hydeDocument.length,
                hydePreview: hydeDocument.substring(0, 100),
            });

            return hydeDocument;
        } catch (error) {
            logger.error('Failed to generate HyDE document:', error);
            throw error;
        }
    }

    /**
     * Generate multiple query variations for broader coverage
     */
    async generateQueryVariants(query: string, options: EnhancementOptions = {}): Promise<string[]> {
        const {
            count = config.ragOptimization.queryEnhancement.queryVariants,
            provider = 'openai',
            model = 'gpt-4o-mini',
        } = options;

        try {
            const prompt = config.ragOptimization.queryEnhancement.multiQueryPromptTemplate
                .replace('{{COUNT}}', count.toString())
                .replace('{{QUERY}}', query);

            logger.debug('Generating query variants', {
                query,
                count,
                provider,
                model,
            });

            const response = await llmService.generateResponse(
                provider,
                model,
                [],
                prompt,
                0.8,
                200
            );

            // Parse JSON response
            let variants: string[] = [];
            try {
                const content = response.content.trim();
                // Handle both raw JSON and markdown code blocks
                const jsonMatch = content.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    variants = JSON.parse(jsonMatch[0]);
                } else {
                    // Fallback: split by newlines
                    variants = content
                        .split('\n')
                        .map(line => line.trim())
                        .filter(line => line.length > 0 && !line.startsWith('[') && !line.startsWith(']'))
                        .map(line => line.replace(/^[-*•]\s*/, ''))
                        .map(line => line.replace(/^["']|["']$/g, ''))
                        .slice(0, count);
                }
            } catch (parseError) {
                logger.warn('Failed to parse query variants JSON, using fallback:', parseError);
                variants = [query];
            }

            logger.debug('Query variants generated', {
                originalQuery: query,
                variantCount: variants.length,
                variants,
            });

            return variants;
        } catch (error) {
            logger.error('Failed to generate query variants:', error);
            return [query];
        }
    }

    /**
     * Enhance query with conversation context
     */
    async enhanceQueryWithContext(
        query: string,
        conversationHistory: ConversationMessage[] = [],
        options: EnhancementOptions = {}
    ): Promise<string> {
        const {
            maxHistoryMessages = config.ragOptimization.queryEnhancement.maxContextMessages,
            provider = 'openai',
            model = 'gpt-4o-mini',
            fallbackToOriginal = true,
        } = options;

        if (!conversationHistory || conversationHistory.length === 0) {
            return query;
        }

        try {
            const recentHistory = conversationHistory.slice(-maxHistoryMessages);

            const historyText = recentHistory
                .map(msg => `${msg.sender}: ${msg.content}`)
                .join('\n');

            const prompt = config.ragOptimization.queryEnhancement.contextInjectionTemplate
                .replace('{{HISTORY}}', historyText)
                .replace('{{QUERY}}', query);

            logger.debug('Enhancing query with conversation context', {
                query,
                historyLength: recentHistory.length,
            });

            const response = await llmService.generateResponse(
                provider,
                model,
                [],
                prompt,
                0.3,
                150
            );

            const enhancedQuery = response.content.trim();

            logger.debug('Query enhanced with context', {
                originalQuery: query,
                enhancedQuery,
            });

            return enhancedQuery;
        } catch (error) {
            logger.error('Failed to enhance query with context:', error);

            if (fallbackToOriginal) {
                logger.warn('Falling back to original query');
                return query;
            }

            throw error;
        }
    }

    /**
     * Full query enhancement pipeline
     */
    async enhanceQuery(
        query: string,
        conversationHistory: ConversationMessage[] = [],
        options: EnhancementOptions = {}
    ): Promise<EnhancedQueryResult> {
        const {
            useContextInjection = config.ragOptimization.queryEnhancement.enabled &&
            config.ragOptimization.queryEnhancement.useConversationContext,
            useHyDE = config.ragOptimization.queryEnhancement.enabled &&
            config.ragOptimization.queryEnhancement.useHyDE,
            useMultiQuery = config.ragOptimization.queryEnhancement.enabled &&
            config.ragOptimization.queryEnhancement.useMultiQuery,
            fallbackOnError = true,
        } = options;

        const result: EnhancedQueryResult = {
            originalQuery: query,
            enhancedQuery: query,
            hydeDocument: null,
            queryVariants: [query],
        };

        try {
            // Step 1: Inject conversation context (if enabled)
            if (useContextInjection && conversationHistory.length > 0) {
                try {
                    result.enhancedQuery = await this.enhanceQueryWithContext(
                        query,
                        conversationHistory,
                        { ...options, fallbackToOriginal: fallbackOnError }
                    );

                    logger.info('Query enhanced with context', {
                        original: query,
                        enhanced: result.enhancedQuery,
                    });
                } catch (error) {
                    logger.error('Context injection failed:', error);
                    if (!fallbackOnError) throw error;
                }
            }

            // Step 2: Generate HyDE document (if enabled)
            if (useHyDE) {
                try {
                    result.hydeDocument = await this.generateHyDE(
                        result.enhancedQuery,
                        options
                    );

                    logger.info('HyDE document generated', {
                        queryLength: result.enhancedQuery.length,
                        hydeLength: result.hydeDocument.length,
                    });
                } catch (error) {
                    logger.error('HyDE generation failed:', error);
                    if (!fallbackOnError) throw error;
                }
            }

            // Step 3: Generate query variants (if enabled)
            if (useMultiQuery) {
                try {
                    result.queryVariants = await this.generateQueryVariants(
                        result.enhancedQuery,
                        options
                    );

                    logger.info('Query variants generated', {
                        count: result.queryVariants.length,
                        variants: result.queryVariants,
                    });
                } catch (error) {
                    logger.error('Query variant generation failed:', error);
                    if (!fallbackOnError) throw error;
                    result.queryVariants = [result.enhancedQuery];
                }
            }

            return result;
        } catch (error) {
            logger.error('Query enhancement pipeline failed:', error);

            if (fallbackOnError) {
                logger.warn('Returning original query due to enhancement failure');
                return {
                    originalQuery: query,
                    enhancedQuery: query,
                    hydeDocument: null,
                    queryVariants: [query],
                };
            }

            throw error;
        }
    }

    /**
     * Get all search queries from enhanced result
     */
    getAllSearchQueries(enhancedResult: EnhancedQueryResult): string[] {
        const queries: string[] = [];

        if (enhancedResult.enhancedQuery) {
            queries.push(enhancedResult.enhancedQuery);
        }

        if (enhancedResult.hydeDocument) {
            queries.push(enhancedResult.hydeDocument);
        }

        if (enhancedResult.queryVariants && Array.isArray(enhancedResult.queryVariants)) {
            queries.push(...enhancedResult.queryVariants);
        }

        if (queries.length === 0 && enhancedResult.originalQuery) {
            queries.push(enhancedResult.originalQuery);
        }

        const uniqueQueries = [...new Set(queries)].filter(q => q && q.trim().length > 0);

        logger.debug('All search queries prepared', {
            totalQueries: uniqueQueries.length,
            queries: uniqueQueries,
        });

        return uniqueQueries;
    }

    /**
     * Check if query enhancement is enabled in config
     */
    isEnhancementEnabled(): boolean {
        return config.ragOptimization.queryEnhancement.enabled;
    }
}

export default new QueryEnhancementService();
