/**
 * LLM Judge Service - Uses LLM to evaluate RAG response quality
 *
 * Implements RAGAS-style evaluation metrics:
 * - Faithfulness: Is the answer grounded in the retrieved context?
 * - Answer Relevance: Does the answer address the question?
 * - Hallucination Detection: Identifies unsupported claims
 */

interface ContextChunk {
    content?: string;
    [key: string]: unknown;
}

interface TokenUsage {
    prompt: number;
    completion: number;
}

interface UsageMetadata {
    prompt_tokens?: number;
    completion_tokens?: number;
}

interface FaithfulnessResult {
    score: number;
    claims: Array<Record<string, unknown>>;
    supportedCount?: number;
    totalClaims?: number;
    reasoning: string;
    tokens?: TokenUsage;
    error?: string;
}

interface RelevanceResult {
    score: number;
    addressesQuestion?: boolean;
    completeness?: string;
    focus?: string;
    reasoning: string;
    tokens?: TokenUsage;
    error?: string;
}

interface ContextRelevanceResult {
    score: number;
    chunkEvaluations?: Array<Record<string, unknown>>;
    chunkScores?: Array<number>;
    relevantChunks?: number;
    totalChunks?: number;
    reasoning: string;
    tokens?: TokenUsage;
    error?: string;
}

interface HallucinationResult {
    hallucinations: Array<Record<string, unknown>>;
    hallucinationCount?: number;
    totalClaims?: number;
    hallucinationRate: number;
    reasoning: string;
    tokens?: TokenUsage;
    error?: string;
}

interface EvaluationResult {
    overall_score: number;
    faithfulness: {
        score: number;
        claims: Array<Record<string, unknown>>;
        reasoning: string;
    };
    answer_relevance: {
        score: number;
        completeness: string;
        reasoning: string;
    };
    context_relevance: {
        score: number;
        relevant_chunks: number;
        total_chunks: number;
        reasoning: string;
    };
    tokens: TokenUsage;
    estimated_cost: number;
}

class LLMJudgeService {
    private llmService: typeof import('../llmService').default | null = null;
    private defaultModel = 'gpt-5-mini';
    private defaultProvider: import('../llmService').LLMProvider = 'openai';

    /**
     * Lazy load LLM service to avoid circular deps
     */
    private async _loadDependencies(): Promise<void> {
        if (!this.llmService) {
            const module = await import('../llmService');
            this.llmService = module.default;
        }
    }

    // ==================== FAITHFULNESS ====================

    async evaluateFaithfulness(answer: string, context: ContextChunk[]): Promise<FaithfulnessResult> {
        await this._loadDependencies();

        if (!answer || !context || context.length === 0) {
            return {
                score: 0,
                claims: [],
                reasoning: 'No answer or context provided'
            };
        }

        const contextText = context
            .map((c, i) => `[${i + 1}] ${c.content || c}`)
            .join('\n\n');

        const prompt = `You are evaluating whether an AI assistant's answer is grounded in (supported by) the provided context.

CONTEXT:
${contextText}

ANSWER TO EVALUATE:
${answer}

Your task:
1. Extract each distinct factual claim from the answer
2. For each claim, determine if it is SUPPORTED by the context (the context contains information that supports this claim) or NOT SUPPORTED (the context does not contain information supporting this claim)
3. Calculate the faithfulness score as: (number of supported claims) / (total claims)

Important guidelines:
- General knowledge statements that don't require context support (e.g., "The sky is blue") should be marked as SUPPORTED
- If the answer says "I don't know" or similar, that's fully faithful (score 1.0)
- Paraphrasing is allowed - the claim doesn't need to be verbatim from context

Respond in this exact JSON format:
{
  "claims": [
    {"claim": "specific claim text", "supported": true, "evidence": "quote or reference from context"},
    {"claim": "another claim", "supported": false, "evidence": "not found in context"}
  ],
  "supported_count": <number>,
  "total_claims": <number>,
  "faithfulness_score": <0.0 to 1.0>,
  "reasoning": "brief explanation of the evaluation"
}`;

        try {
            const response = await this.llmService!.generateResponse(
                this.defaultProvider,
                this.defaultModel,
                [{ role: 'user', content: prompt }],
                undefined,
                0.0,
                1500
            );

            const result = this._parseJsonResponse(response.content);

            return {
                score: (result.faithfulness_score as number) || 0,
                claims: (result.claims as Record<string, unknown>[]) || [],
                supportedCount: (result.supported_count as number) || 0,
                totalClaims: (result.total_claims as number) || 0,
                reasoning: (result.reasoning as string) || '',
                tokens: this._extractUsageTokens(response.metadata)
            };
        } catch (error) {
            console.error('Faithfulness evaluation error:', (error as Error).message);
            return {
                score: 0,
                claims: [],
                reasoning: `Evaluation failed: ${(error as Error).message}`,
                error: (error as Error).message
            };
        }
    }

    // ==================== ANSWER RELEVANCE ====================

    async evaluateAnswerRelevance(question: string, answer: string): Promise<RelevanceResult> {
        await this._loadDependencies();

        if (!question || !answer) {
            return {
                score: 0,
                reasoning: 'No question or answer provided'
            };
        }

        const prompt = `You are evaluating whether an answer is relevant to and addresses the question asked.

QUESTION:
${question}

ANSWER:
${answer}

Evaluate the answer relevance on these criteria:
1. Does the answer directly address what was asked?
2. Is the answer complete (covers all aspects of the question)?
3. Is the answer focused (doesn't include excessive irrelevant information)?

Rate the relevance from 0.0 to 1.0:
- 1.0: Directly and completely answers the question
- 0.7-0.9: Mostly answers with minor gaps or slight tangents
- 0.4-0.6: Partially answers or includes significant irrelevant content
- 0.1-0.3: Tangentially related but doesn't really answer
- 0.0: Completely off-topic or doesn't address the question

Respond in this exact JSON format:
{
  "relevance_score": <0.0 to 1.0>,
  "addresses_question": true/false,
  "completeness": "complete" | "partial" | "incomplete",
  "focus": "focused" | "somewhat_focused" | "unfocused",
  "reasoning": "brief explanation"
}`;

        try {
            const response = await this.llmService!.generateResponse(
                this.defaultProvider,
                this.defaultModel,
                [{ role: 'user', content: prompt }],
                undefined,
                0.0,
                800
            );

            const result = this._parseJsonResponse(response.content);

            return {
                score: (result.relevance_score as number) || 0,
                addressesQuestion: (result.addresses_question as boolean) || false,
                completeness: (result.completeness as string) || 'unknown',
                focus: (result.focus as string) || 'unknown',
                reasoning: (result.reasoning as string) || '',
                tokens: this._extractUsageTokens(response.metadata)
            };
        } catch (error) {
            console.error('Answer relevance evaluation error:', (error as Error).message);
            return {
                score: 0,
                reasoning: `Evaluation failed: ${(error as Error).message}`,
                error: (error as Error).message
            };
        }
    }

    // ==================== CONTEXT RELEVANCE ====================

    async evaluateContextRelevance(question: string, context: ContextChunk[]): Promise<ContextRelevanceResult> {
        await this._loadDependencies();

        if (!question || !context || context.length === 0) {
            return {
                score: 0,
                chunkScores: [],
                reasoning: 'No question or context provided'
            };
        }

        const contextChunks = context.map((c, i) => ({
            index: i + 1,
            content: (c.content || (c as unknown as string)).substring(0, 500)
        }));

        const prompt = `You are evaluating whether the retrieved context chunks are relevant to answering the question.

QUESTION:
${question}

RETRIEVED CONTEXT CHUNKS:
${contextChunks.map(c => `[Chunk ${c.index}]: ${c.content}`).join('\n\n')}

For each chunk, evaluate:
1. Is it relevant to the question?
2. Does it contain information useful for answering?

Respond in this exact JSON format:
{
  "chunk_evaluations": [
    {"chunk": 1, "relevant": true, "usefulness": "high" | "medium" | "low" | "none"},
    {"chunk": 2, "relevant": false, "usefulness": "none"}
  ],
  "relevant_chunks": <number>,
  "total_chunks": <number>,
  "context_precision": <0.0 to 1.0>,
  "reasoning": "brief explanation"
}`;

        try {
            const response = await this.llmService!.generateResponse(
                this.defaultProvider,
                this.defaultModel,
                [{ role: 'user', content: prompt }],
                undefined,
                0.0,
                800
            );

            const result = this._parseJsonResponse(response.content);

            return {
                score: (result.context_precision as number) || 0,
                chunkEvaluations: (result.chunk_evaluations as Record<string, unknown>[]) || [],
                relevantChunks: (result.relevant_chunks as number) || 0,
                totalChunks: (result.total_chunks as number) || context.length,
                reasoning: (result.reasoning as string) || '',
                tokens: this._extractUsageTokens(response.metadata)
            };
        } catch (error) {
            console.error('Context relevance evaluation error:', (error as Error).message);
            return {
                score: 0,
                reasoning: `Evaluation failed: ${(error as Error).message}`,
                error: (error as Error).message
            };
        }
    }

    // ==================== COMBINED EVALUATION ====================

    async evaluateRAGResponse(
        question: string,
        answer: string,
        context: ContextChunk[]
    ): Promise<EvaluationResult> {
        const [faithfulness, relevance, contextRelevance] = await Promise.all([
            this.evaluateFaithfulness(answer, context),
            this.evaluateAnswerRelevance(question, answer),
            this.evaluateContextRelevance(question, context)
        ]);

        const overallScore = (
            faithfulness.score * 0.4 +
            relevance.score * 0.4 +
            contextRelevance.score * 0.2
        );

        const totalTokens = {
            prompt: (faithfulness.tokens?.prompt || 0) +
                (relevance.tokens?.prompt || 0) +
                (contextRelevance.tokens?.prompt || 0),
            completion: (faithfulness.tokens?.completion || 0) +
                (relevance.tokens?.completion || 0) +
                (contextRelevance.tokens?.completion || 0)
        };

        return {
            overall_score: Math.round(overallScore * 1000) / 1000,
            faithfulness: {
                score: faithfulness.score,
                claims: faithfulness.claims,
                reasoning: faithfulness.reasoning
            },
            answer_relevance: {
                score: relevance.score,
                completeness: relevance.completeness || 'unknown',
                reasoning: relevance.reasoning
            },
            context_relevance: {
                score: contextRelevance.score,
                relevant_chunks: contextRelevance.relevantChunks || 0,
                total_chunks: contextRelevance.totalChunks || 0,
                reasoning: contextRelevance.reasoning
            },
            tokens: totalTokens,
            estimated_cost: this._estimateCost(totalTokens)
        };
    }

    // ==================== HALLUCINATION DETECTION ====================

    async detectHallucinations(answer: string, context: ContextChunk[]): Promise<HallucinationResult> {
        await this._loadDependencies();

        if (!answer) {
            return {
                hallucinations: [],
                hallucinationRate: 0,
                reasoning: 'No answer provided'
            };
        }

        const contextText = context
            .map((c, i) => `[${i + 1}] ${c.content || c}`)
            .join('\n\n');

        const prompt = `Analyze the following answer for potential hallucinations - claims that are NOT supported by the provided context and are likely fabricated.

CONTEXT:
${contextText || '(No context provided)'}

ANSWER:
${answer}

Identify any hallucinations:
- Specific facts, numbers, dates that aren't in the context
- Names or entities not mentioned in context
- Claims that contradict the context
- Made-up details that seem plausible but aren't supported

Do NOT flag:
- General knowledge that doesn't need context support
- Reasonable inferences from the context
- "I don't know" type responses

Respond in JSON format:
{
  "hallucinations": [
    {"text": "the hallucinated claim", "type": "fabricated_fact" | "wrong_number" | "invented_entity" | "contradiction", "severity": "high" | "medium" | "low"}
  ],
  "hallucination_count": <number>,
  "total_claims": <number>,
  "hallucination_rate": <0.0 to 1.0>,
  "reasoning": "explanation"
}`;

        try {
            const response = await this.llmService!.generateResponse(
                this.defaultProvider,
                this.defaultModel,
                [{ role: 'user', content: prompt }],
                undefined,
                0.0,
                1000
            );

            const result = this._parseJsonResponse(response.content);

            return {
                hallucinations: (result.hallucinations as Record<string, unknown>[]) || [],
                hallucinationCount: (result.hallucination_count as number) || 0,
                totalClaims: (result.total_claims as number) || 0,
                hallucinationRate: (result.hallucination_rate as number) || 0,
                reasoning: (result.reasoning as string) || '',
                tokens: this._extractUsageTokens(response.metadata)
            };
        } catch (error) {
            console.error('Hallucination detection error:', (error as Error).message);
            return {
                hallucinations: [],
                hallucinationRate: 0,
                reasoning: `Detection failed: ${(error as Error).message}`,
                error: (error as Error).message
            };
        }
    }

    // ==================== HELPER METHODS ====================

    private _parseJsonResponse(content: string): Record<string, unknown> {
        try {
            let jsonStr = content.trim();
            if (jsonStr.startsWith('```json')) {
                jsonStr = jsonStr.slice(7);
            } else if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.slice(3);
            }
            if (jsonStr.endsWith('```')) {
                jsonStr = jsonStr.slice(0, -3);
            }
            jsonStr = jsonStr.trim();

            return JSON.parse(jsonStr);
        } catch (error) {
            console.error('Failed to parse LLM response as JSON:', (error as Error).message);
            console.error('Response content:', content.substring(0, 200));
            return {};
        }
    }

    private _extractUsageTokens(metadata: Record<string, unknown>): TokenUsage {
        const usage = metadata.usage as UsageMetadata | undefined;
        return {
            prompt: typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : 0,
            completion: typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : 0
        };
    }

    private _estimateCost(tokens: TokenUsage): number {
        // gpt-4o-mini pricing (as of 2024): $0.15/1M input, $0.60/1M output
        const inputCost = (tokens.prompt / 1000000) * 0.15;
        const outputCost = (tokens.completion / 1000000) * 0.60;
        return Math.round((inputCost + outputCost) * 1000000) / 1000000;
    }
}

export default new LLMJudgeService();
