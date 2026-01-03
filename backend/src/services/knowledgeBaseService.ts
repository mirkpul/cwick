import db from '../config/database';
import logger from '../config/logger';
import appConfig from '../config/appConfig';
import LLMService, { LLMProvider } from './llmService';
import FileProcessingService from './fileProcessingService';

export interface KnowledgeBase {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    avatar_url?: string;
    llm_provider: string;
    llm_model: string;
    system_prompt: string;
    temperature?: number;
    max_tokens?: number;
    semantic_search_threshold?: number;
    semantic_search_max_results?: number;
    rag_config: RAGConfig;
    is_public: boolean;
    share_url?: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface KnowledgeBaseEntry {
    id?: string;
    kb_id: string;
    title: string;
    content: string;
    content_type: string;
    source_url?: string;
    embedding?: string;
    created_at?: Date;
    provider?: LLMProvider;
}

export interface CreateKnowledgeBaseParams {
    name: string;
    description?: string;
    llmProvider?: string;
    llmModel?: string;
    systemPrompt?: string;
}

export interface UpdateKnowledgeBaseParams extends Partial<CreateKnowledgeBaseParams> {
    avatar_url?: string;
    system_prompt?: string;
    temperature?: number;
    max_tokens?: number;
    semantic_search_threshold?: number;
    semantic_search_max_results?: number;
    is_public?: boolean;
    share_url?: string;
}

export interface RAGConfig {
    knowledgeBaseThreshold?: number;
    emailThreshold?: number;
    hybridSearchEnabled?: boolean;
    vectorWeight?: number;
    bm25Weight?: number;
    fusionMethod?: string;
    rerankingEnabled?: boolean;
    useDiversityFilter?: boolean;
    diversityThreshold?: number;
    useMMR?: boolean;
    mmrLambda?: number;
    semanticBoostEnabled?: boolean;
    maxBoost?: number;
    minBoostThreshold?: number;
    dynamicBoostEnabled?: boolean;
    temporalDecayEnabled?: boolean;
    decayHalfLifeDays?: number;
    maxResults?: number;
    maxEmailRatio?: number;
    maxKBRatio?: number;
    ingestion?: {
        tableMaxColumns?: number;
    };
}

class KnowledgeBaseService {
    async createKnowledgeBase(userId: string, kbData: CreateKnowledgeBaseParams): Promise<KnowledgeBase> {
        try {
            const {
                name,
                description,
                llmProvider = 'openai',
                llmModel,
                systemPrompt,
            } = kbData;

            const result = await db.query(
                `INSERT INTO knowledge_bases (
          user_id, name, description, llm_provider, llm_model, system_prompt
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
                [
                    userId,
                    name,
                    description,
                    llmProvider,
                    llmModel,
                    systemPrompt,
                ]
            );

            logger.info(`Knowledge base created for user ${userId}: ${name}`);
            return result.rows[0] as KnowledgeBase;
        } catch (error) {
            logger.error('Create knowledge base error:', error);
            throw error;
        }
    }

    async updateKnowledgeBase(kbId: string, userId: string, updates: UpdateKnowledgeBaseParams): Promise<KnowledgeBase> {
        try {
            const allowedFields = [
                'name',
                'description',
                'avatar_url',
                'llm_provider',
                'llm_model',
                'system_prompt',
                'temperature',
                'max_tokens',
                'semantic_search_threshold',
                'semantic_search_max_results',
                'is_public',
                'share_url',
            ];

            const updateFields: string[] = [];
            const values: unknown[] = [];
            let paramCount = 1;

            (Object.keys(updates) as Array<keyof UpdateKnowledgeBaseParams>).forEach(key => {
                if (allowedFields.includes(key)) {
                    updateFields.push(`${key} = $${paramCount}`);
                    values.push(updates[key]);
                    paramCount++;
                }
            });

            if (updateFields.length === 0) {
                throw new Error('No valid fields to update');
            }

            values.push(kbId, userId);

            const result = await db.query(
                `UPDATE knowledge_bases
         SET ${updateFields.join(', ')}, updated_at = NOW()
         WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
         RETURNING *`,
                values
            );

            if (result.rows.length === 0) {
                throw new Error('Knowledge base not found or unauthorized');
            }

            logger.info(`Knowledge base updated: ${kbId}`);
            return result.rows[0] as KnowledgeBase;
        } catch (error) {
            logger.error('Update knowledge base error:', error);
            throw error;
        }
    }

    async getKnowledgeBaseByUserId(userId: string): Promise<KnowledgeBase | null> {
        try {
            const result = await db.query(
                'SELECT * FROM knowledge_bases WHERE user_id = $1',
                [userId]
            );

            return result.rows[0] as KnowledgeBase || null;
        } catch (error) {
            logger.error('Get knowledge base error:', error);
            throw error;
        }
    }

    async getKnowledgeBaseById(kbId: string): Promise<KnowledgeBase | null> {
        try {
            const result = await db.query(
                'SELECT * FROM knowledge_bases WHERE id = $1 AND is_active = true',
                [kbId]
            );

            return result.rows[0] as KnowledgeBase || null;
        } catch (error) {
            logger.error('Get knowledge base error:', error);
            throw error;
        }
    }

    async addKnowledgeBaseEntry(kbId: string, entry: KnowledgeBaseEntry): Promise<KnowledgeBaseEntry> {
        try {
            const { title, content, content_type: contentType, source_url: sourceUrl, provider = 'openai' } = entry;
            const resolvedProvider: LLMProvider = provider;

            // Validate content length before processing
            const MAX_CONTENT_LENGTH = 50000; // ~12,500 tokens
            if (content.length > MAX_CONTENT_LENGTH) {
                throw new Error(
                    `Content too large (${content.length} chars). Maximum is ${MAX_CONTENT_LENGTH}.`
                );
            }

            // Generate embedding for the content
            logger.info(`Generating embedding for knowledge entry: "${title}"`);

            const embedding = await LLMService.generateEmbedding(content, resolvedProvider);

            // Validate embedding before insertion
            FileProcessingService.validateEmbedding(embedding);

            const embeddingVector = `[${embedding.join(',')}]`;

            const result = await db.query(
                `INSERT INTO knowledge_base (kb_id, title, content, content_type, source_url, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)
         RETURNING *`,
                [kbId, title, content, contentType, sourceUrl, embeddingVector]
            );

            logger.info(`Knowledge entry added with embedding: ${result.rows[0].id}`);

            return result.rows[0] as KnowledgeBaseEntry;
        } catch (error) {
            logger.error('Add knowledge base entry error:', error);
            throw error;
        }
    }

    async getKnowledgeBase(kbId: string): Promise<KnowledgeBaseEntry[]> {
        try {
            const result = await db.query(
                'SELECT * FROM knowledge_base WHERE kb_id = $1 ORDER BY created_at DESC',
                [kbId]
            );

            return result.rows as KnowledgeBaseEntry[];
        } catch (error) {
            logger.error('Get knowledge base entries error:', error);
            throw error;
        }
    }

    async deleteKnowledgeBaseEntry(entryId: string, kbId: string): Promise<{ success: boolean }> {
        try {
            const result = await db.query(
                'DELETE FROM knowledge_base WHERE id = $1 AND kb_id = $2 RETURNING id',
                [entryId, kbId]
            );

            if (result.rows.length === 0) {
                throw new Error('Knowledge base entry not found');
            }

            logger.info(`Knowledge base entry deleted: ${entryId}`);
            return { success: true };
        } catch (error) {
            logger.error('Delete knowledge base entry error:', error);
            throw error;
        }
    }

    /**
     * Get RAG configuration for a knowledge base
     * Returns stored config merged with defaults from appConfig
     */
    async getRAGConfig(kbId: string): Promise<RAGConfig | null> {
        try {
            const result = await db.query(
                'SELECT rag_config FROM knowledge_bases WHERE id = $1',
                [kbId]
            );

            if (result.rows.length === 0) {
                return null;
            }

            // Default RAG config from appConfig
            const defaultConfig: RAGConfig = {
                knowledgeBaseThreshold: appConfig.semanticSearch.sourceThresholds.knowledgeBase,
                emailThreshold: appConfig.semanticSearch.sourceThresholds.email,
                hybridSearchEnabled: appConfig.ragOptimization.hybridSearch.enabled,
                vectorWeight: appConfig.ragOptimization.hybridSearch.vectorWeight,
                bm25Weight: appConfig.ragOptimization.hybridSearch.bm25Weight,
                fusionMethod: appConfig.ragOptimization.hybridSearch.fusionMethod,
                rerankingEnabled: appConfig.ragOptimization.reranking.enabled,
                useDiversityFilter: appConfig.ragOptimization.reranking.useDiversityFilter,
                diversityThreshold: appConfig.ragOptimization.reranking.diversityThreshold,
                useMMR: appConfig.ragOptimization.reranking.useMMR,
                mmrLambda: appConfig.ragOptimization.reranking.mmrLambda,
                semanticBoostEnabled: appConfig.ragOptimization.reranking.semanticBoost.enabled,
                maxBoost: appConfig.ragOptimization.reranking.semanticBoost.maxBoost,
                minBoostThreshold: appConfig.ragOptimization.reranking.semanticBoost.minThreshold,
                dynamicBoostEnabled: false,
                temporalDecayEnabled: false,
                decayHalfLifeDays: 365,
                maxResults: appConfig.ragOptimization.reranking.finalK,
                maxEmailRatio: appConfig.semanticSearch.ensembleBalancing.maxEmailRatio,
                maxKBRatio: appConfig.semanticSearch.ensembleBalancing.maxKBRatio,
                ingestion: {
                    tableMaxColumns: appConfig.ragOptimization.assetEnrichment.tables.maxColumns,
                },
            };

            // Merge stored config with defaults (stored values override defaults)
            const storedConfig = (result.rows[0].rag_config as Partial<RAGConfig>) || {};
            return { ...defaultConfig, ...storedConfig };
        } catch (error) {
            logger.error('Get RAG config error:', error);
            throw error;
        }
    }

    /**
     * Update RAG configuration for a knowledge base
     */
    async updateRAGConfig(kbId: string, config: RAGConfig): Promise<RAGConfig> {
        try {
            const result = await db.query(
                `UPDATE knowledge_bases
         SET rag_config = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING rag_config`,
                [JSON.stringify(config), kbId]
            );

            if (result.rows.length === 0) {
                throw new Error('Knowledge base not found');
            }

            logger.info(`RAG config updated for KB ${kbId}`);
            return result.rows[0].rag_config;
        } catch (error) {
            logger.error('Update RAG config error:', error);
            throw error;
        }
    }
}

export default new KnowledgeBaseService();
