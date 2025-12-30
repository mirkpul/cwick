/**
 * Synthetic Generator Service - Generates test Q&A pairs from knowledge base
 *
 * Approaches:
 * 1. Chunk-based: Generate questions from individual KB chunks
 * 2. Multi-hop: Generate questions requiring multiple chunks
 * 3. Conversational: Generate follow-up question sequences
 */

import { pool } from '../../config/database';

interface GenerationOptions {
    count?: number;
    types?: string[];
    difficulties?: string[];
    onProgress?: (progress: number, current: number, total: number) => void;
}

interface ChunkGenerationOptions {
    questionsPerChunk?: number;
    types?: string[];
    difficulty?: string;
}

interface KBEntry {
    id: string;
    title?: string;
    content: string;
    content_type?: string;
}

interface GeneratedQA {
    question: string;
    expectedAnswer: string;
    keyFacts: string[];
    reasoning: string;
    questionType?: string;
    difficulty?: string;
    sourceType?: string;
    sourceKbIds?: string[];
}

interface DatasetOptions {
    name?: string;
    description?: string;
    totalQuestions?: number;
    typeDistribution?: Record<string, number>;
    difficultyDistribution?: Record<string, number>;
}

class SyntheticGeneratorService {
    private llmService: typeof import('../llmService').default | null = null;
    private defaultModel = 'gpt-5-mini';
    private defaultProvider: import('../llmService').LLMProvider = 'openai';

    /**
     * Lazy load dependencies
     */
    private async _loadDependencies(): Promise<void> {
        if (!this.llmService) {
            const module = await import('../llmService');
            this.llmService = module.default;
        }
    }

    // ==================== MAIN GENERATION METHODS ====================

    async generateFromKnowledgeBase(kbId: string, options: GenerationOptions = {}): Promise<GeneratedQA[]> {
        await this._loadDependencies();

        const {
            count = 20,
            types = ['simple', 'complex'],
            difficulties = ['easy', 'medium', 'hard'],
            onProgress = null
        } = options;

        const kbEntries = await this._getKnowledgeBaseEntries(kbId);

        if (kbEntries.length === 0) {
            throw new Error('No knowledge base entries found for this twin');
        }

        const results: GeneratedQA[] = [];
        const questionsPerType = Math.ceil(count / types.length);

        let completed = 0;

        for (const type of types) {
            const typeCount = Math.min(questionsPerType, count - results.length);

            for (let i = 0; i < typeCount; i++) {
                try {
                    const selectedEntries = this._selectEntriesForType(kbEntries, type);
                    const difficulty = difficulties[i % difficulties.length];

                    const qa = await this._generateSingleQA(selectedEntries, type, difficulty);

                    if (qa) {
                        results.push({
                            ...qa,
                            questionType: type,
                            difficulty,
                            sourceType: 'synthetic',
                            sourceKbIds: selectedEntries.map(e => e.id)
                        });
                    }

                    completed++;
                    if (onProgress) {
                        onProgress(Math.round((completed / count) * 100), completed, count);
                    }
                } catch (error) {
                    console.error(`Error generating ${type} question:`, (error as Error).message);
                }

                await this._delay(100);
            }
        }

        return results;
    }

    async generateFromChunks(chunks: KBEntry[], options: ChunkGenerationOptions = {}): Promise<GeneratedQA[]> {
        await this._loadDependencies();

        const {
            questionsPerChunk = 2,
            types = ['simple'],
            difficulty = 'medium'
        } = options;

        const results: GeneratedQA[] = [];

        for (const chunk of chunks) {
            for (let i = 0; i < questionsPerChunk; i++) {
                const type = types[i % types.length];

                try {
                    const qa = await this._generateSingleQA([chunk], type, difficulty);

                    if (qa) {
                        results.push({
                            ...qa,
                            questionType: type,
                            difficulty,
                            sourceType: 'synthetic',
                            sourceKbIds: [chunk.id]
                        });
                    }
                } catch (error) {
                    console.error(`Error generating question for chunk ${chunk.id}:`, (error as Error).message);
                }

                await this._delay(100);
            }
        }

        return results;
    }

    // ==================== QUESTION TYPE GENERATORS ====================

    private async _generateSingleQA(entries: KBEntry[], type: string, difficulty: string): Promise<GeneratedQA | null> {
        const content = entries
            .map(e => `Title: ${e.title || 'Untitled'}\nContent: ${e.content}`)
            .join('\n\n---\n\n');

        const prompt = this._getGenerationPrompt(content, type, difficulty);
        const systemPrompt = 'You are a helpful assistant that generates test questions and answers for RAG benchmark evaluation. Always respond with valid JSON.';

        try {
            const response = await this.llmService!.generateResponse(
                this.defaultProvider,
                this.defaultModel,
                [{ role: 'user', content: prompt }],
                systemPrompt,
                0.7,
                1000
            );

            if (!response.content) {
                console.warn('Empty response from LLM');
                return null;
            }

            return this._parseGeneratedQA(response.content);
        } catch (error) {
            console.error('Q&A generation error:', (error as Error).message);
            return null;
        }
    }

    private _getGenerationPrompt(content: string, type: string, difficulty: string): string {
        const typeInstructions: Record<string, string> = {
            simple: `Generate a simple, direct question that can be answered from a single fact in the content.
The question should be straightforward and have a clear, concise answer.
Examples: "What is X?", "How does Y work?", "When did Z happen?"`,

            complex: `Generate a complex question that requires understanding multiple aspects of the content.
The question should need synthesis or analysis to answer properly.
Examples: "How does X affect Y?", "What are the advantages and disadvantages of Z?", "Compare A and B."`,

            multi_hop: `Generate a multi-hop question that requires combining information from different parts of the content.
The question should need the reader to connect multiple facts to form a complete answer.
Examples: "Given that X leads to Y, and Y causes Z, what is the overall impact on W?"`,

            conversational: `Generate a question that a user might ask in a natural conversation.
The question should be informal and might be ambiguous or incomplete.
Examples: "Can you tell me more about X?", "What about Y?", "How do I do Z?"`
        };

        const difficultyInstructions: Record<string, string> = {
            easy: 'The question should be basic and suitable for someone new to the topic.',
            medium: 'The question should require moderate domain knowledge to understand and answer.',
            hard: 'The question should be challenging and require deep understanding of the topic.'
        };

        return `You are generating test questions for a RAG (Retrieval Augmented Generation) benchmark.

CONTENT TO GENERATE QUESTIONS FROM:
${content}

INSTRUCTIONS:
${typeInstructions[type] || typeInstructions.simple}

DIFFICULTY:
${difficultyInstructions[difficulty] || difficultyInstructions.medium}

Generate ONE question and its expected answer based on the content above.

IMPORTANT:
- The question must be answerable from the provided content
- The expected answer should be what a correct RAG system should return
- Be specific - avoid overly generic questions
- The answer should be comprehensive but concise

Respond in this exact JSON format:
{
  "question": "The generated question",
  "expected_answer": "The ideal answer that should be generated",
  "key_facts": ["fact 1 needed to answer", "fact 2 needed to answer"],
  "reasoning": "Brief explanation of why this is a good test question"
}`;
    }

    private _parseGeneratedQA(content: string): GeneratedQA | null {
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

            const parsed = JSON.parse(jsonStr);

            if (!parsed.question || !parsed.expected_answer) {
                return null;
            }

            return {
                question: parsed.question,
                expectedAnswer: parsed.expected_answer,
                keyFacts: parsed.key_facts || [],
                reasoning: parsed.reasoning || ''
            };
        } catch (error) {
            console.error('Failed to parse generated Q&A:', (error as Error).message);
            return null;
        }
    }

    // ==================== HELPER METHODS ====================

    private async _getKnowledgeBaseEntries(kbId: string, limit = 100): Promise<KBEntry[]> {
        const result = await pool.query(
            `SELECT id, title, content, content_type
       FROM knowledge_base
       WHERE kb_id = $1
         AND content IS NOT NULL
         AND LENGTH(content) > 100
       ORDER BY created_at DESC
       LIMIT $2`,
            [kbId, limit]
        );
        return result.rows;
    }

    private _selectEntriesForType(entries: KBEntry[], type: string): KBEntry[] {
        if (entries.length === 0) return [];

        switch (type) {
            case 'multi_hop':
                return this._selectRandom(entries, Math.min(3, entries.length));

            case 'complex':
                return this._selectRandom(entries, Math.min(2, entries.length));

            case 'simple':
            case 'conversational':
            default:
                return this._selectRandom(entries, 1);
        }
    }

    private _selectRandom<T>(array: T[], n: number): T[] {
        const shuffled = [...array].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, n);
    }

    private _delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==================== BATCH GENERATION ====================

    async generateBenchmarkDataset(kbId: string, options: DatasetOptions = {}): Promise<Record<string, unknown>> {
        const {
            name = `Synthetic Dataset ${new Date().toISOString().slice(0, 10)}`,
            description = 'Auto-generated benchmark dataset',
            totalQuestions = 50,
            typeDistribution = { simple: 0.4, complex: 0.4, multi_hop: 0.2 },
            difficultyDistribution = { easy: 0.3, medium: 0.5, hard: 0.2 }
        } = options;

        const types: string[] = [];
        for (const [type, ratio] of Object.entries(typeDistribution)) {
            const count = Math.round(totalQuestions * ratio);
            for (let i = 0; i < count; i++) {
                types.push(type);
            }
        }

        const difficulties: string[] = [];
        for (const [diff, ratio] of Object.entries(difficultyDistribution)) {
            const count = Math.round(totalQuestions * ratio);
            for (let i = 0; i < count; i++) {
                difficulties.push(diff);
            }
        }

        types.sort(() => Math.random() - 0.5);
        difficulties.sort(() => Math.random() - 0.5);

        const questions = await this.generateFromKnowledgeBase(kbId, {
            count: totalQuestions,
            types: [...new Set(types)],
            difficulties: [...new Set(difficulties)]
        });

        return {
            name,
            description,
            datasetType: 'synthetic',
            generationConfig: {
                totalQuestions,
                typeDistribution,
                difficultyDistribution,
                generatedAt: new Date().toISOString()
            },
            questions
        };
    }
}

export default new SyntheticGeneratorService();
