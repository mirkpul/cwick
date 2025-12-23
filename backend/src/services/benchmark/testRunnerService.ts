/**
 * Test Runner Service - Executes benchmark runs against the RAG pipeline
 *
 * Responsibilities:
 * - Execute benchmark runs (full, retrieval-only, generation-only)
 * - Instrument RAG pipeline to capture intermediate results
 * - Track timing for each pipeline stage
 * - Store results and compute metrics
 */

import { pool } from '../../config/database';
import config from '../../config/appConfig';
import { v4 as uuidv4 } from 'uuid';
import datasetService from './datasetService';
import metricCalculatorService from './metricCalculatorService';
import type { LLMMessage, LLMProvider } from '../llmService';

type DatasetQuestion = Awaited<ReturnType<typeof datasetService.listQuestions>>[number];

type AggregateMetricsResult = ReturnType<typeof metricCalculatorService.calculateAggregateMetrics>;
type RunExecutionResult = {
    runId: string;
    status: 'completed';
    totalQuestions: number;
    aggregateMetrics: AggregateMetricsResult;
};

interface RunOptions {
    name?: string;
    description?: string;
    runType?: string;
}

interface ListRunsOptions {
    status?: string | null;
    limit?: number;
    offset?: number;
}

interface ExecuteOptions {
    parallelism?: number;
    onProgress?: ((progress: number, current: number, total: number) => void) | null;
}

interface Twin {
    id: string;
    user_id: string;
    llm_provider?: LLMProvider | string;
    llm_model?: string;
    system_prompt?: string;
    temperature?: number;
    max_tokens?: number;
    handover_threshold?: number;
    semantic_search_threshold?: number;
    semantic_search_max_results?: number;
    [key: string]: unknown;
}

interface ConversationContext {
    id: string;
    twin_id: string;
    user_id: string;
    status: string;
    llm_provider: LLMProvider;
    llm_model: string;
    temperature: number;
    max_tokens: number;
    handover_threshold: number;
    semantic_search_threshold?: number;
    semantic_search_max_results?: number;
    [key: string]: unknown;
}

interface Run {
    id: string;
    twin_id: string;
    dataset_id: string;
    status: string;
    run_type: string;
    rag_config: Record<string, unknown>;
    aggregate_metrics?: AggregateMetricsResult | null;
    [key: string]: unknown;
}

interface SearchResult {
    id: string;
    title?: string;
    content?: string;
    relevance_score?: number;
    is_relevant?: boolean;
    relevance_reasoning?: string;
    [key: string]: unknown;
}

interface InstrumentedSearchResult {
    results: SearchResult[];
    context: SearchResult[];
    enhancedQuery: string;
    timings: Record<string, number>;
}

class TestRunnerService {
    private chatService: typeof import('../chatService').default | null = null;
    private digitalTwinService: typeof import('../digitalTwinService').default | null = null;
    private fileProcessingService: typeof import('../fileProcessingService').default | null = null;
    private llmJudgeService: typeof import('./llmJudgeService').default | null = null;
    private llmService: typeof import('../llmService').default | null = null;

    /**
     * Lazy load dependencies to avoid circular imports
     */
    private async _loadDependencies(): Promise<void> {
        if (!this.chatService || !this.digitalTwinService || !this.fileProcessingService) {
            const [chatModule, digitalTwinModule, fileProcessingModule] = await Promise.all([
                import('../chatService'),
                import('../digitalTwinService'),
                import('../fileProcessingService'),
            ]);
            this.chatService = chatModule.default;
            this.digitalTwinService = digitalTwinModule.default;
            this.fileProcessingService = fileProcessingModule.default;
        }

        if (!this.llmJudgeService) {
            const module = await import('./llmJudgeService');
            this.llmJudgeService = module.default;
        }

        if (!this.llmService) {
            const module = await import('../llmService');
            this.llmService = module.default;
        }
    }

    // ==================== RUN MANAGEMENT ====================

    async createRun(twinId: string, datasetId: string, options: RunOptions = {}): Promise<Run> {
        await this._loadDependencies();

        const { name, description, runType = 'full' } = options;

        const ragConfig = await this.digitalTwinService!.getRAGConfig(twinId);

        const id = uuidv4();
        const result = await pool.query(
            `INSERT INTO benchmark_runs
       (id, twin_id, dataset_id, name, description, run_type, rag_config, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
            [id, twinId, datasetId, name, description, runType, JSON.stringify(ragConfig)]
        );

        return result.rows[0];
    }

    async getRun(runId: string): Promise<Run | null> {
        const result = await pool.query(
            `SELECT r.*,
              d.name as dataset_name,
              d.total_questions as dataset_questions
       FROM benchmark_runs r
       LEFT JOIN benchmark_datasets d ON d.id = r.dataset_id
       WHERE r.id = $1`,
            [runId]
        );
        return result.rows[0] || null;
    }

    async listRuns(twinId: string, options: ListRunsOptions = {}): Promise<Run[]> {
        const { status = null, limit = 20, offset = 0 } = options;

        const conditions = ['r.twin_id = $1'];
        const values: unknown[] = [twinId];
        let paramIndex = 2;

        if (status) {
            conditions.push(`r.status = $${paramIndex}`);
            values.push(status);
            paramIndex++;
        }

        values.push(limit, offset);

        const result = await pool.query(
            `SELECT r.*,
              d.name as dataset_name
       FROM benchmark_runs r
       LEFT JOIN benchmark_datasets d ON d.id = r.dataset_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            values
        );
        return result.rows;
    }

    async updateRunStatus(runId: string, status: string, extra: Record<string, unknown> = {}): Promise<void> {
        const updates: Record<string, unknown> = { status, ...extra };
        const setClause: string[] = [];
        const values: unknown[] = [runId];
        let paramIndex = 2;

        for (const [key, value] of Object.entries(updates)) {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            setClause.push(`${dbKey} = $${paramIndex}`);
            values.push(typeof value === 'object' ? JSON.stringify(value) : value);
            paramIndex++;
        }

        await pool.query(
            `UPDATE benchmark_runs SET ${setClause.join(', ')} WHERE id = $1`,
            values
        );
    }

    async deleteRun(runId: string): Promise<{ deleted: boolean }> {
        await pool.query('DELETE FROM benchmark_runs WHERE id = $1', [runId]);
        return { deleted: true };
    }

    // ==================== RUN EXECUTION ====================

    async executeRun(runId: string, options: ExecuteOptions = {}): Promise<RunExecutionResult> {
        await this._loadDependencies();

        const { parallelism: _parallelism = 1, onProgress = null } = options;

        const run = await this.getRun(runId);
        if (!run) throw new Error('Run not found');
        if (run.status === 'running') throw new Error('Run is already running');
        if (run.status === 'completed') throw new Error('Run is already completed');

        await this.updateRunStatus(runId, 'running', { started_at: new Date() });

        try {
            const questions = await datasetService.listQuestions(run.dataset_id, {
                includeInactive: false
            });

            if (questions.length === 0) {
                throw new Error('No questions in dataset');
            }

            const twin = await this._getTwin(run.twin_id);

            let completed = 0;
            const results: Array<Record<string, unknown>> = [];

            for (const question of questions) {
                try {
                    const result = await this._executeQuestion(run, twin, question);
                    results.push(result);
                } catch (error) {
                    console.error(`Error processing question ${question.id}:`, (error as Error).message);
                    results.push(await this._storeFailedResult(runId, question, (error as Error).message));
                }

                completed++;
                const progress = Math.round((completed / questions.length) * 100);

                await this.updateRunStatus(runId, 'running', { progress });

                if (onProgress) {
                    onProgress(progress, completed, questions.length);
                }
            }

            const aggregateMetrics = metricCalculatorService.calculateAggregateMetrics(results);
            const totals = this._calculateTotals(results);

            await this.updateRunStatus(runId, 'completed', {
                completed_at: new Date(),
                progress: 100,
                aggregate_metrics: aggregateMetrics,
                total_llm_tokens: totals.llmTokens,
                total_embedding_tokens: totals.embeddingTokens,
                estimated_cost_usd: totals.estimatedCost
            });

            return {
                runId,
                status: 'completed',
                totalQuestions: questions.length,
                aggregateMetrics
            };
        } catch (error) {
            await this.updateRunStatus(runId, 'failed', {
                error_message: (error as Error).message,
                completed_at: new Date()
            });
            throw error;
        }
    }

    private async _executeQuestion(run: Run, twin: Twin, question: DatasetQuestion): Promise<Record<string, unknown>> {
        const startTime = Date.now();
        const timings: Record<string, number | null> = {};

        const mockConversation: ConversationContext = {
            id: uuidv4(),
            twin_id: run.twin_id,
            user_id: twin.user_id,
            status: 'active',
            llm_provider: this._resolveLLMProvider(twin.llm_provider),
            llm_model: twin.llm_model || 'gpt-5-mini',
            temperature: typeof twin.temperature === 'number' ? twin.temperature : config.llm.defaultTemperature,
            max_tokens: typeof twin.max_tokens === 'number' ? twin.max_tokens : config.llm.defaultMaxTokens,
            handover_threshold: typeof twin.handover_threshold === 'number' ? twin.handover_threshold : config.handover.defaultThreshold,
            semantic_search_threshold: typeof twin.semantic_search_threshold === 'number' ? twin.semantic_search_threshold : config.semanticSearch.sourceThresholds.knowledgeBase,
            semantic_search_max_results: typeof twin.semantic_search_max_results === 'number'
                ? twin.semantic_search_max_results
                : config.semanticSearch.defaultMaxResults,
        };

        const searchStart = Date.now();
        const searchResults = await this._performInstrumentedSearch(
            mockConversation,
            question.question,
            run.rag_config
        );
        timings.total_search_ms = Date.now() - searchStart;

        if (searchResults.timings) {
            Object.assign(timings, searchResults.timings);
        }

        let generatedAnswer: string | null = null;
        let generationTokens = { prompt: 0, completion: 0 };

        if (run.run_type !== 'retrieval_only') {
            const genStart = Date.now();
            const generation = await this._generateResponse(
                twin,
                question.question,
                searchResults.context
            );
            timings.generation_ms = Date.now() - genStart;
            generatedAnswer = generation.answer;
            generationTokens = generation.tokens;
        }

        timings.total_latency_ms = Date.now() - startTime;

        const retrievedIds = searchResults.results.map((r: SearchResult) => r.id);
        const expectedIds = question.expected_context_ids || [];

        const retrievalMetrics = metricCalculatorService.calculateRetrievalMetrics(
            searchResults.results,
            expectedIds
        );

        const generationMetrics: Record<string, unknown> = {};
        const llmJudgeTokens = { prompt: 0, completion: 0 };

        if (generatedAnswer) {
            if (question.expected_answer) {
                generationMetrics.semantic_similarity = metricCalculatorService.calculateTextSimilarity(
                    generatedAnswer,
                    question.expected_answer
                );
            }
            generationMetrics.context_coverage = metricCalculatorService.calculateContextCoverage(
                generatedAnswer,
                searchResults.context
            );

            if (searchResults.context && searchResults.context.length > 0) {
                try {
                    const llmJudgeService = this.llmJudgeService!;

                    const faithfulnessStart = Date.now();
                    const faithfulness = await llmJudgeService.evaluateFaithfulness(
                        generatedAnswer,
                        searchResults.context
                    );
                    timings.faithfulness_eval_ms = Date.now() - faithfulnessStart;
                    generationMetrics.faithfulness = faithfulness.score;
                    generationMetrics.faithfulness_reasoning = faithfulness.reasoning;
                    llmJudgeTokens.prompt += faithfulness.tokens?.prompt || 0;
                    llmJudgeTokens.completion += faithfulness.tokens?.completion || 0;

                    const relevanceStart = Date.now();
                    const relevance = await llmJudgeService.evaluateAnswerRelevance(
                        question.question,
                        generatedAnswer
                    );
                    timings.relevance_eval_ms = Date.now() - relevanceStart;
                    generationMetrics.answer_relevance = relevance.score;
                    generationMetrics.answer_relevance_reasoning = relevance.reasoning;
                    llmJudgeTokens.prompt += relevance.tokens?.prompt || 0;
                    llmJudgeTokens.completion += relevance.tokens?.completion || 0;

                    const ctxRelStart = Date.now();
                    const contextRelevance = await llmJudgeService.evaluateContextRelevance(
                        question.question,
                        searchResults.context
                    );
                    timings.context_relevance_eval_ms = Date.now() - ctxRelStart;

                    if (!expectedIds || expectedIds.length === 0) {
                        retrievalMetrics.precision = contextRelevance.score;
                    } else {
                        retrievalMetrics.llm_context_precision = contextRelevance.score;
                    }

                    if (contextRelevance.chunkEvaluations) {
                        type ChunkEvaluation = {
                            chunk?: number;
                            relevant?: boolean;
                            usefulness?: string;
                        };
                        const chunkEvaluations: ChunkEvaluation[] = contextRelevance.chunkEvaluations.map((evaluation) => {
                            const evalRecord = evaluation as Record<string, unknown>;
                            const chunkValue = evalRecord['chunk'];
                            const relevantValue = evalRecord['relevant'];
                            const usefulnessValue = evalRecord['usefulness'];

                            return {
                                chunk: typeof chunkValue === 'number' ? chunkValue : undefined,
                                relevant: typeof relevantValue === 'boolean' ? relevantValue : undefined,
                                usefulness: typeof usefulnessValue === 'string' ? usefulnessValue : undefined,
                            };
                        });

                        searchResults.results.forEach((resultItem: SearchResult, index: number) => {
                            const evaluation = chunkEvaluations.find(chunkEval => chunkEval.chunk === index + 1);
                            if (evaluation) {
                                resultItem.relevance_score = evaluation.relevant ? 1 : 0;
                                resultItem.is_relevant = evaluation.relevant;
                                resultItem.relevance_reasoning = evaluation.usefulness;
                            }
                        });
                    }

                    llmJudgeTokens.prompt += contextRelevance.tokens?.prompt || 0;
                    llmJudgeTokens.completion += contextRelevance.tokens?.completion || 0;

                } catch (evalError) {
                    console.error('LLM Judge evaluation error:', (evalError as Error).message);
                }
            }
        }

        generationTokens.prompt += llmJudgeTokens.prompt;
        generationTokens.completion += llmJudgeTokens.completion;

        const result = await this._storeResult(run.id, question, {
            enhanced_query: searchResults.enhancedQuery,
            retrieved_context_ids: retrievedIds,
            retrieved_context: searchResults.results,
            generated_answer: generatedAnswer,
            llm_provider: twin.llm_provider,
            llm_model: twin.llm_model,
            ...timings,
            prompt_tokens: generationTokens.prompt,
            completion_tokens: generationTokens.completion,
            metrics: {
                retrieval: retrievalMetrics,
                generation: generationMetrics
            }
        });

        return result;
    }

    private async _performInstrumentedSearch(
        conversation: ConversationContext,
        query: string,
        _ragConfig: Record<string, unknown>
    ): Promise<InstrumentedSearchResult> {
        try {
            const searchStart = Date.now();

            const results = await this.chatService!.performEnhancedRAGSearch(
                conversation,
                query,
                []
            );

            const searchTime = Date.now() - searchStart;

            return {
                results: results || [],
                context: results || [],
                enhancedQuery: query,
                timings: {
                    vector_search_ms: searchTime
                }
            };
        } catch (error) {
            console.error('Search error:', (error as Error).message);
            return {
                results: [],
                context: [],
                enhancedQuery: query,
                timings: {}
            };
        }
    }

    private async _generateResponse(
        twin: Twin,
        question: string,
        context: SearchResult[]
    ): Promise<{ answer: string | null; tokens: { prompt: number; completion: number } }> {
        try {
            const llmService = this.llmService!;

            const contextStr = context.map((chunk, index) =>
                `[${index + 1}] ${chunk.title || 'Context'}: ${chunk.content || ''}`
            ).join('\n\n');

            const systemPrompt = twin.system_prompt ||
                'You are a helpful assistant. Answer based on the provided context.';

            const messages: LLMMessage[] = [
                {
                    role: 'system',
                    content: `${systemPrompt}\n\nContext:\n${contextStr}`
                },
                {
                    role: 'user',
                    content: question
                }
            ];

            const response = await llmService.generateResponse(
                this._resolveLLMProvider(twin.llm_provider),
                twin.llm_model || 'gpt-5-mini',
                messages,
                undefined,
                twin.temperature || 0.7,
                twin.max_tokens || 500
            );

            const usage = (response.metadata.usage as { prompt_tokens?: number; completion_tokens?: number }) || {};

            return {
                answer: response.content,
                tokens: {
                    prompt: typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0,
                    completion: typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0
                }
            };
        } catch (error) {
            console.error('Generation error:', (error as Error).message);
            return {
                answer: null,
                tokens: { prompt: 0, completion: 0 }
            };
        }
    }

    private _resolveLLMProvider(provider?: Twin['llm_provider']): LLMProvider {
        return provider === 'anthropic' ? 'anthropic' : 'openai';
    }

    private async _storeResult(runId: string, question: DatasetQuestion, data: Record<string, unknown>): Promise<Record<string, unknown>> {
        const id = uuidv4();
        const result = await pool.query(
            `INSERT INTO benchmark_results
       (id, run_id, question_id, input_question, enhanced_query,
        retrieved_context_ids, retrieved_context, generated_answer,
        llm_provider, llm_model,
        query_enhancement_ms, vector_search_ms, bm25_search_ms,
        fusion_ms, reranking_ms, generation_ms, total_latency_ms,
        prompt_tokens, completion_tokens, embedding_tokens, metrics)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       RETURNING *`,
            [
                id,
                runId,
                question.id,
                question.question,
                data.enhanced_query,
                data.retrieved_context_ids,
                JSON.stringify(data.retrieved_context),
                data.generated_answer,
                data.llm_provider,
                data.llm_model,
                data.query_enhancement_ms || null,
                data.vector_search_ms || null,
                data.bm25_search_ms || null,
                data.fusion_ms || null,
                data.reranking_ms || null,
                data.generation_ms || null,
                data.total_latency_ms || null,
                data.prompt_tokens || null,
                data.completion_tokens || null,
                data.embedding_tokens || null,
                JSON.stringify(data.metrics)
            ]
        );
        return result.rows[0];
    }

    private async _storeFailedResult(runId: string, question: DatasetQuestion, errorMessage: string): Promise<Record<string, unknown>> {
        const id = uuidv4();
        const result = await pool.query(
            `INSERT INTO benchmark_results
       (id, run_id, question_id, input_question, metrics)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [
                id,
                runId,
                question.id,
                question.question,
                JSON.stringify({ error: errorMessage })
            ]
        );
        return result.rows[0];
    }

    private async _getTwin(twinId: string): Promise<Twin> {
        const result = await pool.query(
            'SELECT * FROM digital_twins WHERE id = $1',
            [twinId]
        );
        return result.rows[0];
    }

    private _calculateTotals(results: Array<Record<string, unknown>>): { llmTokens: number; embeddingTokens: number; estimatedCost: number } {
        let llmTokens = 0;
        let embeddingTokens = 0;

        for (const result of results) {
            llmTokens += ((result.prompt_tokens as number) || 0) + ((result.completion_tokens as number) || 0);
            embeddingTokens += (result.embedding_tokens as number) || 0;
        }

        const llmCost = (llmTokens / 1000) * 0.002;
        const embeddingCost = (embeddingTokens / 1000) * 0.0001;
        const estimatedCost = llmCost + embeddingCost;

        return {
            llmTokens,
            embeddingTokens,
            estimatedCost: Math.round(estimatedCost * 1000000) / 1000000
        };
    }

    // ==================== RESULTS RETRIEVAL ====================

    async getRunResults(runId: string, options: { limit?: number; offset?: number } = {}): Promise<Array<Record<string, unknown>>> {
        const { limit = 100, offset = 0 } = options;
        const result = await pool.query(
            `SELECT r.*, q.question as original_question, q.expected_answer, q.expected_context_ids
       FROM benchmark_results r
       JOIN benchmark_questions q ON q.id = r.question_id
       WHERE r.run_id = $1
       ORDER BY r.created_at ASC
       LIMIT $2 OFFSET $3`,
            [runId, limit, offset]
        );
        return result.rows;
    }

    async getResult(resultId: string): Promise<Record<string, unknown> | null> {
        const result = await pool.query(
            `SELECT r.*, q.question as original_question, q.expected_answer, q.expected_context_ids
       FROM benchmark_results r
       JOIN benchmark_questions q ON q.id = r.question_id
       WHERE r.id = $1`,
            [resultId]
        );
        return result.rows[0] || null;
    }

    async addHumanEvaluation(
        resultId: string,
        userId: string,
        evaluation: { rating: number; feedback: string }
    ): Promise<Record<string, unknown>> {
        const { rating, feedback } = evaluation;
        const result = await pool.query(
            `UPDATE benchmark_results
       SET human_rating = $1, human_feedback = $2, evaluated_by = $3, evaluated_at = NOW()
       WHERE id = $4
       RETURNING *`,
            [rating, feedback, userId, resultId]
        );
        return result.rows[0];
    }

    // ==================== COMPARISON ====================

    async compareRuns(runIdA: string, runIdB: string): Promise<Record<string, unknown>> {
        const [runA, runB] = await Promise.all([
            this.getRun(runIdA),
            this.getRun(runIdB)
        ]);

        if (!runA || !runB) {
            throw new Error('One or both runs not found');
        }

        if (runA.status !== 'completed' || runB.status !== 'completed') {
            throw new Error('Both runs must be completed to compare');
        }

        if (!runA.aggregate_metrics || !runB.aggregate_metrics) {
            throw new Error('Run metrics are missing');
        }

        const metricsComparison = metricCalculatorService.compareMetrics(
            runA.aggregate_metrics,
            runB.aggregate_metrics
        );

        let aWins = 0;
        let bWins = 0;
        for (const metric of Object.values(metricsComparison) as Array<{ better: string }>) {
            if (metric.better === 'a') aWins++;
            if (metric.better === 'b') bWins++;
        }

        const winner = aWins > bWins ? 'a' : bWins > aWins ? 'b' : 'tie';

        return {
            runA: {
                id: runA.id,
                name: runA.name,
                config: runA.rag_config,
                metrics: runA.aggregate_metrics
            },
            runB: {
                id: runB.id,
                name: runB.name,
                config: runB.rag_config,
                metrics: runB.aggregate_metrics
            },
            comparison: metricsComparison,
            summary: {
                winner,
                aWins,
                bWins,
                ties: Object.keys(metricsComparison).length - aWins - bWins
            }
        };
    }
}

export default new TestRunnerService();
