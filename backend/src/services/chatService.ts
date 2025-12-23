import db from '../config/database';
import vectorStoreService from './vectorStoreService';
import logger from '../config/logger';
import * as ragLogger from '../config/ragLogger';
import llmService, { LLMMessage, LLMProvider } from './llmService';
import contextService, { SemanticResult as ContextSemanticResult } from './contextService';
import fileProcessingService from './fileProcessingService';
import digitalTwinService, { RAGConfig } from './digitalTwinService';
import type { KnowledgeBaseEntry } from './digitalTwinService';
import config from '../config/appConfig';
import queryEnhancementService, { EnhancedQueryResult as QueryEnhancementResult } from './queryEnhancementService';
import ragRetrievalService from './ragRetrievalService';

// RAG Optimization Services
import hybridSearchService from './hybridSearchService';
import rerankingService from './rerankingService';
import ensembleBalancingService from './ensembleBalancingService';

interface EndUserData {
    email?: string;
    name?: string;
    phone?: string;
    metadata?: Record<string, unknown>;
}

interface Message {
    id: string;
    conversation_id: string;
    sender: string;
    content: string;
    created_at: Date;
    role?: string;
    [key: string]: unknown;
}

interface Conversation {
    id: string;
    kb_id: string;
    user_id: string;
    status: string;
    llm_provider: string;
    llm_model: string;
    temperature: number;
    max_tokens: number;
    semantic_search_threshold?: number;
    semantic_search_max_results?: number;
    name?: string;
    [key: string]: unknown;
}

interface RAGSearchResult {
    id: string;
    title?: string;
    content: string;
    source?: string;
    similarity?: number;
    score?: number;
    fusedScore?: number;
    combinedScore?: number;
    rerankScore?: number;
    file_name?: string;
    total_chunks?: number;
    chunk_index?: number;
    [key: string]: unknown;
}

interface TwinResponse {
    message?: Record<string, unknown>;
}

class ChatService {
    private applySourceBalancing(results: RAGSearchResult[], limit: number): RAGSearchResult[] {
        const balancing = config.semanticSearch.ensembleBalancing;
        if (!balancing.enabled) {
            return results.slice(0, limit);
        }

        const maxEmail = Math.floor(limit * balancing.maxEmailRatio);
        const maxKB = Math.floor(limit * balancing.maxKBRatio);
        const minEmail = balancing.minEmailResults;
        const minKB = balancing.minKBResults;

        const selected: RAGSearchResult[] = [];
        const remainingEmail: RAGSearchResult[] = [];
        const remainingKB: RAGSearchResult[] = [];

        let emailCount = 0;
        let kbCount = 0;

        for (const result of results) {
            if (selected.length >= limit) break;
            if (result.source === 'email') {
                if (emailCount < maxEmail) {
                    selected.push(result);
                    emailCount += 1;
                } else {
                    remainingEmail.push(result);
                }
                continue;
            }
            if (result.source === 'knowledge_base') {
                if (kbCount < maxKB) {
                    selected.push(result);
                    kbCount += 1;
                } else {
                    remainingKB.push(result);
                }
                continue;
            }
            selected.push(result);
        }

        const fillFrom = (pool: RAGSearchResult[], target: number, counter: () => number, inc: () => void) => {
            while (selected.length < limit && counter() < target && pool.length > 0) {
                selected.push(pool.shift()!);
                inc();
            }
        };

        fillFrom(remainingEmail, minEmail, () => emailCount, () => { emailCount += 1; });
        fillFrom(remainingKB, minKB, () => kbCount, () => { kbCount += 1; });

        while (selected.length < limit && (remainingEmail.length > 0 || remainingKB.length > 0)) {
            const next = remainingEmail.shift() || remainingKB.shift();
            if (next) {
                selected.push(next);
            }
        }

        return selected.slice(0, limit);
    }

    async createConversation(kbId: string, endUserData: EndUserData): Promise<Record<string, unknown>> {
        try {
            let endUserId: string;
            if (endUserData.email) {
                const existingUser = await db.query(
                    'SELECT id FROM end_users WHERE email = $1',
                    [endUserData.email]
                );

                if (existingUser.rows.length > 0) {
                    endUserId = existingUser.rows[0].id;
                } else {
                    const newUser = await db.query(
                        'INSERT INTO end_users (email, name, phone, metadata) VALUES ($1, $2, $3, $4) RETURNING id',
                        [endUserData.email, endUserData.name, endUserData.phone, JSON.stringify(endUserData.metadata || {})]
                    );
                    endUserId = newUser.rows[0].id;
                }
            } else {
                const newUser = await db.query(
                    'INSERT INTO end_users (name, metadata) VALUES ($1, $2) RETURNING id',
                    [endUserData.name || 'Anonymous', JSON.stringify(endUserData.metadata || {})]
                );
                endUserId = newUser.rows[0].id;
            }

            const result = await db.query(
                'INSERT INTO conversations (kb_id, end_user_id, metadata) VALUES ($1, $2, $3) RETURNING *',
                [kbId, endUserId, JSON.stringify(endUserData.metadata || {})]
            );

            await this.trackAnalyticsEvent(kbId, 'conversation_started', {
                conversation_id: result.rows[0].id,
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Create conversation error:', error);
            throw error;
        }
    }

    async sendMessage(conversationId: string, sender: string, content: string): Promise<Message> {
        try {
            logger.debug('Sending message', {
                conversationId,
                sender,
                contentLength: content?.length,
                contentPreview: content?.substring(0, 100),
            });

            const result = await db.query(
                'INSERT INTO messages (conversation_id, sender, content) VALUES ($1, $2, $3) RETURNING *',
                [conversationId, sender, content]
            );

            logger.debug('Message saved to database', {
                messageId: result.rows[0].id,
                conversationId,
                sender,
            });

            return result.rows[0] as Message;
        } catch (error) {
            logger.error('Send message error:', error);
            throw error;
        }
    }

    async getConversationMessages(conversationId: string, limit = 50): Promise<Message[]> {
        try {
            const result = await db.query(
                `SELECT * FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
                [conversationId, limit]
            );

            return result.rows.reverse() as Message[];
        } catch (error) {
            logger.error('Get conversation messages error:', error);
            throw error;
        }
    }

    async getKnowledgeBase(kbId: string, limit = 50): Promise<KnowledgeBaseEntry[]> {
        try {
            const result = await db.query<KnowledgeBaseEntry>(
                `SELECT * FROM knowledge_base
         WHERE kb_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
                [kbId, limit]
            );

            return result.rows;
        } catch (error) {
            logger.error('Get knowledge base error:', error);
            throw error;
        }
    }

    async generateTwinResponse(conversationId: string, _userMessage: string): Promise<TwinResponse> {
        try {
            logger.debug('Generating twin response', { conversationId });

            const convResult = await db.query(
                `SELECT c.*, kb.* FROM conversations c
         JOIN knowledge_bases kb ON c.kb_id = kb.id
         WHERE c.id = $1`,
                [conversationId]
            );

            if (convResult.rows.length === 0) {
                throw new Error('Conversation not found');
            }

            const conversation = convResult.rows[0] as Conversation;

            const messageHistoryLimit = config.conversations.messageHistoryLimit || 10;
            const messages = await this.getConversationMessages(conversationId, messageHistoryLimit);
            const isFirstMessage = messages.length === 0;

            logger.debug('Message context retrieved', {
                conversationId,
                messageCount: messages.length,
                isFirstMessage,
                kbId: conversation.kb_id,
                twinName: conversation.name,
            });

            let semanticResults: RAGSearchResult[] | null = null;
            const lastUserMessage = [...messages].reverse().find((m) => m.sender === 'user');
            const userQuery = lastUserMessage?.content;

            if (userQuery && conversation.kb_id) {
                try {
                    semanticResults = await this.performEnhancedRAGSearch(
                        conversation,
                        userQuery,
                        messages
                    );
                } catch (error) {
                    logger.error('Enhanced RAG search failed, continuing without it:', error);
                }
            }

            let systemPrompt: string;

            const semanticContext = this.buildSemanticResults(semanticResults);

            if (isFirstMessage) {
                const knowledgeBase = await this.getKnowledgeBase(conversation.kb_id);
                systemPrompt = contextService.generateEnhancedSystemPrompt(
                    conversation,
                    knowledgeBase,
                    semanticContext
                );
            } else {
                systemPrompt = contextService.generateContinuationPrompt(conversation, semanticContext);
            }

            ragLogger.logLLMContext(
                conversationId,
                conversation.llm_provider,
                conversation.llm_model,
                systemPrompt.length,
                semanticResults?.length || 0,
                messages.length
            );

            const provider = this.resolveProvider(conversation.llm_provider);
            const llmMessages = this.formatMessagesForLLM(messages);
            const response = await llmService.generateResponse(
                provider,
                conversation.llm_model,
                llmMessages,
                systemPrompt,
                conversation.temperature,
                conversation.max_tokens
            );

            const totalTokensUsed = this.extractTotalTokens(response.metadata);
            const finishReason = this.extractFinishReason(response.metadata);

            ragLogger.logLLMResponse(
                conversationId,
                response.content?.length,
                totalTokensUsed,
                finishReason
            );

            const savedMessage = await this.sendMessage(conversationId, 'assistant', response.content);

            await this.trackAnalyticsEvent(conversation.kb_id, 'message_sent', {
                conversation_id: conversationId,
            });

            return {
                message: savedMessage,
            };
        } catch (error) {
            logger.error('Generate twin response error:', error);
            throw error;
        }
    }

    async generateTwinResponseStreaming(
        conversationId: string,
        _userMessage: string,
        onChunk: (chunk: string) => void | Promise<void>
    ): Promise<TwinResponse> {
        try {
            logger.debug('Generating twin response (streaming)', { conversationId });

            const convResult = await db.query(
                `SELECT c.*, kb.* FROM conversations c
         JOIN knowledge_bases kb ON c.kb_id = kb.id
         WHERE c.id = $1`,
                [conversationId]
            );

            if (convResult.rows.length === 0) {
                throw new Error('Conversation not found');
            }

            const conversation = convResult.rows[0] as Conversation;

            const messageHistoryLimit = config.conversations.messageHistoryLimit || 10;
            const messages = await this.getConversationMessages(conversationId, messageHistoryLimit);
            const isFirstMessage = messages.length === 0;

            let semanticResults: RAGSearchResult[] | null = null;
            const lastUserMessage = [...messages].reverse().find((m) => m.sender === 'user');
            const userQuery = lastUserMessage?.content;

            if (userQuery && conversation.kb_id) {
                try {
                    semanticResults = await this.performEnhancedRAGSearch(
                        conversation,
                        userQuery,
                        messages
                    );
                } catch (error) {
                    logger.error('Enhanced RAG search failed (streaming):', error);
                }
            }

            let systemPrompt: string;

            const semanticContext = this.buildSemanticResults(semanticResults);

            if (isFirstMessage) {
                const knowledgeBase = await this.getKnowledgeBase(conversation.kb_id);
                systemPrompt = contextService.generateEnhancedSystemPrompt(
                    conversation,
                    knowledgeBase,
                    semanticContext
                );
            } else {
                systemPrompt = contextService.generateContinuationPrompt(conversation, semanticContext);
            }

            const provider = this.resolveProvider(conversation.llm_provider);
            const llmMessages = this.formatMessagesForLLM(messages);
            const streamingCallback = async (chunk: string): Promise<void> => {
                await onChunk(chunk);
            };

            const response = await llmService.generateStreamingResponse(
                provider,
                conversation.llm_model,
                llmMessages,
                systemPrompt,
                streamingCallback,
                conversation.temperature,
                conversation.max_tokens
            );

            const savedMessage = await this.sendMessage(conversationId, 'assistant', response.content);

            await this.trackAnalyticsEvent(conversation.kb_id, 'message_sent', {
                conversation_id: conversationId,
            });

            return {
                message: savedMessage,
            };
        } catch (error) {
            logger.error('Generate twin response streaming error:', error);
            throw error;
        }
    }

    async trackAnalyticsEvent(kbId: string, eventType: string, eventData: Record<string, unknown>): Promise<void> {
        try {
            await db.query(
                'INSERT INTO analytics_events (kb_id, event_type, event_data) VALUES ($1, $2, $3)',
                [kbId, eventType, JSON.stringify(eventData)]
            );
        } catch (error) {
            logger.error('Track analytics error:', error);
        }
    }

    async getConversationsByKbId(kbId: string, limit = 20): Promise<Array<Record<string, unknown>>> {
        try {
            const result = await db.query(
                `SELECT c.*, eu.name as end_user_name, eu.email as end_user_email,
         COUNT(m.id) as message_count
         FROM conversations c
         JOIN end_users eu ON c.end_user_id = eu.id
         LEFT JOIN messages m ON c.id = m.conversation_id
         WHERE c.kb_id = $1
         GROUP BY c.id, eu.name, eu.email
         ORDER BY c.created_at DESC
         LIMIT $2`,
                [kbId, limit]
            );

            return result.rows;
        } catch (error) {
            logger.error('Get conversations error:', error);
            throw error;
        }
    }

    /**
     * Perform enhanced RAG search with all optimizations
     */
    async performEnhancedRAGSearch(
        conversation: Conversation,
        userQuery: string,
        conversationHistory: Message[]
    ): Promise<RAGSearchResult[]> {
        const startTime = Date.now();

        try {
            const ragConfig = (await digitalTwinService.getRAGConfig(conversation.kb_id).catch(() => null)) || {} as RAGConfig;

            const kbThreshold = ragConfig.knowledgeBaseThreshold ??
                conversation.semantic_search_threshold ??
                config.semanticSearch.sourceThresholds.knowledgeBase;
            const emailThreshold = ragConfig.emailThreshold ??
                config.semanticSearch.sourceThresholds.email;
            const maxResults = ragConfig.maxResults ??
                conversation.semantic_search_max_results ??
                config.semanticSearch.defaultMaxResults;

            const threshold = kbThreshold;

            ragLogger.logSearchStart(conversation.id, userQuery, {
                threshold,
                kbThreshold,
                emailThreshold,
                maxResults,
                usingPerTwinConfig: Boolean(ragConfig.knowledgeBaseThreshold),
            });

            // Step 1: Query Enhancement
            let enhancedQuery: QueryEnhancementResult = {
                originalQuery: userQuery,
                enhancedQuery: userQuery,
                hydeDocument: null,
                queryVariants: [userQuery],
            };

            if (queryEnhancementService.isEnhancementEnabled()) {
                enhancedQuery = await queryEnhancementService.enhanceQuery(
                    userQuery,
                    conversationHistory,
                    {
                        useContextInjection: config.ragOptimization.queryEnhancement.useConversationContext,
                        useHyDE: config.ragOptimization.queryEnhancement.useHyDE,
                        useMultiQuery: config.ragOptimization.queryEnhancement.useMultiQuery,
                    }
                );

                ragLogger.logQueryEnhancement(userQuery, enhancedQuery);
            }

            const searchQueries = queryEnhancementService.getAllSearchQueries(enhancedQuery);

            // Step 2: Perform searches
            const provider = this.resolveProvider(conversation.llm_provider);
            const useHybridSearch = hybridSearchService.isHybridSearchEnabled();

            let allResults: RAGSearchResult[] = [];
            const allVectorResults: RAGSearchResult[] = [];
            const allBM25Results: RAGSearchResult[] = [];
            const allFusedResults: RAGSearchResult[] = [];

            for (const query of searchQueries) {
                const kbVectorResults = await fileProcessingService.searchKnowledgeBaseWithAdaptiveFiltering(
                    conversation.kb_id,
                    query,
                    {
                        limit: maxResults * 2,
                        provider,
                        useAdaptive: config.semanticSearch.useAdaptiveFiltering,
                        threshold: threshold,
                    }
                ).catch((err: Error) => {
                    logger.error('Knowledge base vector search failed:', err);
                    return [];
                });

                const emailVectorResults = await this._searchEmails(
                    conversation.user_id,
                    query,
                    maxResults * 2,
                    threshold,
                    provider,
                    conversationHistory
                ).catch((err: Error) => {
                    logger.error('Email vector search failed:', err);
                    return [];
                });

                const vectorResults: RAGSearchResult[] = [...kbVectorResults, ...emailVectorResults].map(result =>
                    this.normalizeSearchResult(result as Record<string, unknown>)
                );
                allVectorResults.push(...vectorResults);

                if (useHybridSearch) {
                    const kbBM25Results = await this._performBM25Search(
                        conversation.kb_id,
                        conversation.user_id,
                        query,
                        maxResults * 2
                    );
                    allBM25Results.push(...kbBM25Results);

                    const fusionMethod = hybridSearchService.getFusionMethod();

                    let fusedResults: RAGSearchResult[];
                    if (fusionMethod === 'rrf') {
                        const fused = hybridSearchService.reciprocalRankFusion(
                            vectorResults,
                            kbBM25Results,
                            { k: config.ragOptimization.hybridSearch.rffK }
                        );
                        fusedResults = fused.map(result => this.normalizeSearchResult(result as Record<string, unknown>));
                    } else {
                        const fused = hybridSearchService.weightedFusion(
                            vectorResults,
                            kbBM25Results,
                            {
                                vectorWeight: config.ragOptimization.hybridSearch.vectorWeight,
                                bm25Weight: config.ragOptimization.hybridSearch.bm25Weight,
                            }
                        );
                        fusedResults = fused.map(result => this.normalizeSearchResult(result as Record<string, unknown>));
                    }
                    allFusedResults.push(...fusedResults);
                    allResults.push(...fusedResults);
                } else {
                    allResults.push(...vectorResults);
                }
            }

            // Step 3: Merge results
            if (searchQueries.length > 1) {
                    const mergedResults = hybridSearchService.mergeResults(
                        [allResults],
                        { combineMethod: 'max' }
                    );
                    allResults = mergedResults.map(result => this.normalizeSearchResult(result as Record<string, unknown>));
                }

            // Apply source-specific thresholds
            const allResultsBeforeThreshold = [...allResults];
            allResults = allResults.filter(r => {
                const score = r.score || r.similarity || 0;
                const sourceThreshold = r.source === 'email' ? emailThreshold : kbThreshold;
                return score >= sourceThreshold;
            });

            // Apply temporal decay
            if (ragConfig.temporalDecayEnabled) {
                const decayedResults = rerankingService.applyTemporalDecay(allResults, {
                    enabled: true,
                    halfLifeDays: ragConfig.decayHalfLifeDays || 365,
                });
                allResults = decayedResults.map(result => this.normalizeSearchResult(result as Record<string, unknown>));
            }

            // Step 4: Reranking
            const rerankingEnabled = ragConfig.rerankingEnabled ?? rerankingService.isRerankingEnabled();

            if (rerankingEnabled) {
                const rerankedResultsRaw = rerankingService.rerank(
                    userQuery,
                    allResults,
                    {
                        useDiversity: ragConfig.useDiversityFilter ?? config.ragOptimization.reranking.useDiversityFilter,
                        useSemanticBoost: ragConfig.semanticBoostEnabled ?? true,
                        useMMR: ragConfig.useMMR ?? config.ragOptimization.reranking.useMMR,
                        finalK: maxResults * 2,
                        lambda: ragConfig.mmrLambda ?? config.ragOptimization.reranking.mmrLambda,
                        threshold: ragConfig.diversityThreshold ?? config.ragOptimization.reranking.diversityThreshold,
                        maxBoost: ragConfig.maxBoost ?? config.ragOptimization.reranking.semanticBoost?.maxBoost ?? 0.05,
                        minBoostThreshold: ragConfig.minBoostThreshold ?? config.ragOptimization.reranking.semanticBoost?.minThreshold ?? 0.30,
                        dynamicBoostEnabled: ragConfig.dynamicBoostEnabled ?? false,
                    }
                );
                const rerankedResults = rerankedResultsRaw.map(result =>
                    this.normalizeSearchResult(result as Record<string, unknown>)
                );

                ragLogger.logReranking(
                    allResults.length,
                    rerankedResults,
                    config.ragOptimization.reranking.useDiversityFilter,
                    config.ragOptimization.reranking.useMMR
                );

                const balancedResultsRaw = ensembleBalancingService.processEnsemble(
                    rerankedResults,
                    maxResults,
                    { skipThreshold: true }
                );
                const balancedResults = balancedResultsRaw.map(result =>
                    this.normalizeSearchResult(result as Record<string, unknown>)
                );

                const totalTime = Date.now() - startTime;
            ragLogger.logPipelineSummary({
                conversationId: conversation.id,
                query: userQuery,
                config: {
                    usingPerTwinConfig: Boolean(ragConfig.knowledgeBaseThreshold),
                    kbThreshold,
                    emailThreshold,
                    threshold,
                },
                    vectorResults: allVectorResults,
                    bm25Results: allBM25Results,
                    fusedResults: allFusedResults.length > 0 ? allFusedResults : allResultsBeforeThreshold,
                    afterThreshold: allResults,
                    afterRerank: rerankedResults,
                    finalResults: balancedResults,
                    totalTimeMs: totalTime,
                });

                return balancedResults;
            }

            // No reranking
            const sortedResults = allResults.sort((a, b) => {
                const scoreA = a.fusedScore || a.combinedScore || a.similarity || 0;
                const scoreB = b.fusedScore || b.combinedScore || b.similarity || 0;
                return scoreB - scoreA;
            });

            const balancedResultsRaw = ensembleBalancingService.processEnsemble(
                sortedResults,
                maxResults,
                { skipThreshold: true }
            );
            const balancedResults = balancedResultsRaw.map(result =>
                this.normalizeSearchResult(result as Record<string, unknown>)
            );

            const totalTime = Date.now() - startTime;
            ragLogger.logPipelineSummary({
                conversationId: conversation.id,
                query: userQuery,
                config: {
                    usingPerTwinConfig: Boolean(ragConfig.knowledgeBaseThreshold),
                    kbThreshold,
                    emailThreshold,
                    threshold,
                },
                vectorResults: allVectorResults,
                bm25Results: allBM25Results,
                fusedResults: allFusedResults.length > 0 ? allFusedResults : allResultsBeforeThreshold,
                afterThreshold: allResults,
                afterRerank: [],
                finalResults: balancedResults,
                totalTimeMs: totalTime,
            });

            return balancedResults;
        } catch (error) {
            ragLogger.logError('Enhanced RAG Search', error as Error, {
                conversationId: conversation?.id,
                userQuery: userQuery?.substring(0, 100),
            });
            return [];
        }
    }

    /**
     * Perform BM25 search on knowledge base and emails
     */
    async _performBM25Search(
        kbId: string,
        userId: string,
        query: string,
        limit: number
    ): Promise<RAGSearchResult[]> {
        try {
            if (ragRetrievalService.isEnabled()) {
                const results = await ragRetrievalService.search(query, kbId, userId, limit);
                return results.map(result => ({
                    id: result.id,
                    content: result.content,
                    score: result.score,
                    source: result.source_type,
                    file_name: result.file_name,
                    title: result.metadata?.title,
                    senderName: result.metadata?.senderName,
                    senderEmail: result.metadata?.senderEmail,
                }));
            }

            const queryTokens = hybridSearchService.tokenize(query);

            if (queryTokens.length === 0) {
                return [];
            }

            // Vector search against knowledge_base namespace
            const useVector = vectorStoreService.isEnabled();

            if (useVector) {
                const embedding = await llmService.generateEmbedding(query, 'openai');

                const vectorKb = await vectorStoreService.search({
                    vector: embedding,
                    namespace: 'knowledge_base',
                    limit: limit * 2,
                });

                const vectorEmail = await vectorStoreService.search({
                    vector: embedding,
                    namespace: 'email',
                    limit: limit * 2,
                });

                const kbIds = vectorKb.map(r => r.id);
                const emailIds = vectorEmail.map(r => r.id);

                const kbDocs: RAGSearchResult[] = kbIds.length
                    ? await (async () => {
                        const placeholders = kbIds.map((_, idx) => `$${idx + 1}`).join(',');
                        const kbResult = await db.query(
                            `SELECT id, title, content, file_name AS "fileName", chunk_index AS "chunkIndex", content_type AS "contentType", 'knowledge_base' as source
                             FROM knowledge_base
                             WHERE id IN (${placeholders})`,
                            kbIds
                        );
                        const scoreMap = new Map(vectorKb.map(r => [r.id, r.score || 0]));
                        return kbResult.rows.map(row => ({
                            ...this.normalizeSearchResult(row as Record<string, unknown>),
                            score: scoreMap.get(row.id) || 0,
                        }));
                    })()
                    : [];

                const emailDocs: RAGSearchResult[] = emailIds.length
                    ? await (async () => {
                        const placeholders = emailIds.map((_, idx) => `$${idx + 1}`).join(',');
                        const emailResult = await db.query(
                            `SELECT id, subject AS title, body_text AS content, sender_name AS "senderName", sender_email AS "senderEmail", sent_at AS "sentAt", 'email' as source, 'email' as content_type
                             FROM email_knowledge
                             WHERE id IN (${placeholders})`,
                            emailIds
                        );
                        const scoreMap = new Map(vectorEmail.map(r => [r.id, r.score || 0]));
                        return emailResult.rows.map(row => ({
                            ...this.normalizeSearchResult(row as Record<string, unknown>),
                            score: scoreMap.get(row.id) || 0,
                        }));
                    })()
                    : [];

                const combined = [...kbDocs, ...emailDocs]
                    .sort((a, b) => (b.score || 0) - (a.score || 0));
                return this.applySourceBalancing(combined, limit);
            }

            // Fallback BM25-like search (original logic)
            const kbResult = await db.query(
                `SELECT id, title, content, file_name AS "fileName", chunk_index AS "chunkIndex", content_type AS "contentType", 'knowledge_base' as source
                 FROM knowledge_base
                 WHERE kb_id = $1
                 LIMIT $2`,
                [kbId, limit * 2]
            );

            const emailResult = await db.query(
                `SELECT
                  id,
                  subject AS title,
                  body_text AS content,
                  sender_name AS "senderName",
                  sender_email AS "senderEmail",
                  sent_at AS "sentAt",
                  'email' as source,
                  'email' as content_type,
                  0 as score
                FROM email_knowledge
                WHERE user_id = $1
                LIMIT $2`,
                [userId, limit * 2]
            );

            const allDocs: RAGSearchResult[] = [...kbResult.rows, ...emailResult.rows].map(row =>
                this.normalizeSearchResult(row as Record<string, unknown>)
            );

            const avgDocLength =
                allDocs.reduce((sum: number, doc) => sum + doc.content.length, 0) /
                (allDocs.length || 1);

            const scoredDocs = allDocs.map((doc) => {
                const docText = doc.content.toLowerCase();
                const docLength = doc.content.length;
                const docTokens = hybridSearchService.tokenize(docText);

                let bm25Score = 0;

                for (const term of queryTokens) {
                    const termFreq = docTokens.filter((t: string) => t === term).length;

                    if (termFreq === 0) continue;

                    const docsWithTerm = allDocs.filter((document) =>
                        hybridSearchService.tokenize(document.content || '').includes(term)
                    ).length;

                    const termScore = hybridSearchService.calculateBM25Score(
                        termFreq,
                        docLength,
                        avgDocLength,
                        allDocs.length,
                        docsWithTerm
                    );

                    bm25Score += termScore;
                }

                return {
                    ...doc,
                    score: bm25Score,
                };
            });

            const filteredDocs = scoredDocs.filter(doc => (doc.score || 0) > 0);
            const sortedDocs = filteredDocs.sort((a, b) => (b.score || 0) - (a.score || 0));
            return this.applySourceBalancing(sortedDocs, limit);
        } catch (error) {
            logger.error('BM25 search failed:', error);
            return [];
        }
    }

    /**
     * Search emails for semantic matches
     */
    async _searchEmails(
        userId: string,
        query: string,
        limit: number,
        threshold: number,
        provider: LLMProvider = 'openai',
        conversationHistory: Message[] = []
    ): Promise<RAGSearchResult[]> {
        try {
            let searchQuery = query;

            if (config.ragOptimization?.queryEnhancement?.enabled) {
                try {
                    const enhanced = await queryEnhancementService.enhanceQuery(
                        query,
                        conversationHistory,
                        {
                            useContextInjection: config.ragOptimization.queryEnhancement.useConversationContext,
                            useHyDE: false,
                            useMultiQuery: false,
                        }
                    );
                    searchQuery = enhanced.enhancedQuery || query;
                } catch {
                    searchQuery = query;
                }
            }

            const queryEmbedding = await llmService.generateEmbedding(searchQuery, provider);

            const result = await db.query(
                `SELECT
          id,
          subject AS title,
          sender_name AS "senderName",
          sender_email AS "senderEmail",
          sent_at AS "sentAt",
          body_text AS content,
          1 - (embedding <=> $1::vector) AS similarity,
          'email' as source,
          'email' as content_type
        FROM email_knowledge
        WHERE user_id = $2
          AND embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $3`,
                [JSON.stringify(queryEmbedding), userId, limit]
            );

            return result.rows.map(row => this.normalizeSearchResult(row as Record<string, unknown>));
        } catch (error) {
            logger.error('Email search for chat failed:', error);
            return [];
        }
    }

    private formatMessagesForLLM(messages: Message[]): LLMMessage[] {
        return messages.map((msg): LLMMessage => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.content,
        }));
    }

    private resolveProvider(provider?: string): LLMProvider {
        return provider === 'anthropic' ? 'anthropic' : 'openai';
    }

    private normalizeSearchResult(record: Record<string, unknown>): RAGSearchResult {
        const idValue = record.id;
        const chunkMeta = record as { file_name?: string; fileName?: string; total_chunks?: number; totalChunks?: number; chunk_index?: number; chunkIndex?: number };
        return {
            id: typeof idValue === 'string' ? idValue : String(idValue),
            title: typeof record.title === 'string' ? record.title : undefined,
            content: typeof record.content === 'string' ? record.content : '',
            source: typeof record.source === 'string' ? record.source : undefined,
            similarity: typeof record.similarity === 'number' ? record.similarity : undefined,
            score: typeof record.score === 'number' ? record.score : undefined,
            fusedScore: typeof record.fusedScore === 'number' ? record.fusedScore : undefined,
            combinedScore: typeof record.combinedScore === 'number' ? record.combinedScore : undefined,
            rerankScore: typeof record.rerankScore === 'number' ? record.rerankScore : undefined,
            file_name: typeof chunkMeta.file_name === 'string'
                ? chunkMeta.file_name
                : typeof chunkMeta.fileName === 'string'
                    ? chunkMeta.fileName
                    : undefined,
            total_chunks: typeof chunkMeta.total_chunks === 'number'
                ? chunkMeta.total_chunks
                : typeof chunkMeta.totalChunks === 'number'
                    ? chunkMeta.totalChunks
                    : undefined,
            chunk_index: typeof chunkMeta.chunk_index === 'number'
                ? chunkMeta.chunk_index
                : typeof chunkMeta.chunkIndex === 'number'
                    ? chunkMeta.chunkIndex
                    : undefined,
        };
    }

    private buildSemanticResults(results: RAGSearchResult[] | null): ContextSemanticResult[] | null {
        if (!results || results.length === 0) {
            return null;
        }

        return results.map(result => ({
            title: result.title,
            similarity: result.similarity ?? result.score ?? 0,
            content: result.content,
            file_name: result.file_name,
            total_chunks: result.total_chunks,
            chunk_index: result.chunk_index,
        }));
    }

    private extractTotalTokens(metadata: Record<string, unknown> | undefined): number | undefined {
        if (!metadata) return undefined;
        const usage = metadata['usage'];
        if (usage && typeof usage === 'object' && 'total_tokens' in usage) {
            const totalTokens = (usage as { total_tokens?: number }).total_tokens;
            if (typeof totalTokens === 'number') {
                return totalTokens;
            }
        }
        return undefined;
    }

    private extractFinishReason(metadata: Record<string, unknown> | undefined): string | undefined {
        if (!metadata) return undefined;
        const finishReason = metadata['finish_reason'];
        if (typeof finishReason === 'string') {
            return finishReason;
        }
        const stopReason = metadata['stop_reason'];
        if (typeof stopReason === 'string') {
            return stopReason;
        }
        return undefined;
    }
}

export default new ChatService();
