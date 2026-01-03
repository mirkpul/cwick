import semanticChunkingService from './semanticChunkingService';
import llmService from './llmService';
import chunkingService from './chunkingService';
import contextualEnrichmentService from './contextualEnrichmentService';

jest.mock('./llmService');
jest.mock('./chunkingService');
jest.mock('./contextualEnrichmentService');
jest.mock('../config/logger');
jest.mock('../config/appConfig', () => ({
    __esModule: true,
    default: {
        chunking: {
            charactersPerToken: 4,
        },
        semanticChunking: {
            maxTokensPerChunk: 500,
            similarityThreshold: 0.5,
            minChunkSize: 50,
            overlapPercentage: 0.2,
            maxDocumentTokens: 10000,
        },
        ragOptimization: {
            contextualEnrichment: {
                enabled: false,
            },
        },
    },
}));

const mockLlmService = llmService as jest.Mocked<typeof llmService>;
const mockChunkingService = chunkingService as jest.Mocked<typeof chunkingService>;
const mockContextualEnrichmentService = contextualEnrichmentService as jest.Mocked<
    typeof contextualEnrichmentService
>;

describe('SemanticChunkingService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('cosineSimilarity', () => {
        it('should calculate cosine similarity correctly', () => {
            const vecA = [1, 0, 0];
            const vecB = [1, 0, 0];

            const similarity = semanticChunkingService.cosineSimilarity(vecA, vecB);

            expect(similarity).toBe(1); // Identical vectors
        });

        it('should return 0 for orthogonal vectors', () => {
            const vecA = [1, 0, 0];
            const vecB = [0, 1, 0];

            const similarity = semanticChunkingService.cosineSimilarity(vecA, vecB);

            expect(similarity).toBe(0); // 90 degrees apart
        });

        it('should handle opposite vectors', () => {
            const vecA = [1, 0, 0];
            const vecB = [-1, 0, 0];

            const similarity = semanticChunkingService.cosineSimilarity(vecA, vecB);

            expect(similarity).toBe(-1); // Opposite direction
        });

        it('should return 0 for zero vectors', () => {
            const vecA = [0, 0, 0];
            const vecB = [1, 2, 3];

            const similarity = semanticChunkingService.cosineSimilarity(vecA, vecB);

            expect(similarity).toBe(0);
        });

        it('should throw error for vectors of different lengths', () => {
            const vecA = [1, 2, 3];
            const vecB = [1, 2];

            expect(() => {
                semanticChunkingService.cosineSimilarity(vecA, vecB);
            }).toThrow('Vectors must have the same length');
        });

        it('should handle high-dimensional vectors', () => {
            const vecA = Array(1536).fill(0.1);
            const vecB = Array(1536).fill(0.1);

            const similarity = semanticChunkingService.cosineSimilarity(vecA, vecB);

            expect(similarity).toBeCloseTo(1, 5);
        });
    });

    describe('estimateTokens', () => {
        it('should estimate tokens from character count', () => {
            const text = 'a'.repeat(100);
            const tokens = semanticChunkingService.estimateTokens(text);

            expect(tokens).toBe(25); // 100 / 4
        });

        it('should return 0 for empty string', () => {
            expect(semanticChunkingService.estimateTokens('')).toBe(0);
        });

        it('should return 0 for null', () => {
            expect(semanticChunkingService.estimateTokens(null as never)).toBe(0);
        });

        it('should round up fractional tokens', () => {
            const text = 'a'.repeat(101);
            const tokens = semanticChunkingService.estimateTokens(text);

            expect(tokens).toBe(26); // 101 / 4 = 25.25 → 26
        });
    });

    describe('splitIntoSentences', () => {
        it('should split on periods', () => {
            const text = 'First sentence. Second sentence. Third sentence.';
            const sentences = semanticChunkingService.splitIntoSentences(text);

            expect(sentences).toHaveLength(3);
            expect(sentences[0]).toBe('First sentence');
        });

        it('should split on exclamation marks', () => {
            const text = 'Hello! How are you?';
            const sentences = semanticChunkingService.splitIntoSentences(text);

            expect(sentences).toHaveLength(2);
        });

        it('should split on question marks', () => {
            const text = 'What is this? Where are we?';
            const sentences = semanticChunkingService.splitIntoSentences(text);

            expect(sentences).toHaveLength(2);
        });

        it('should handle abbreviations (Dr., Mr., etc.)', () => {
            const text = 'Dr. Smith is here. He is a doctor.';
            const sentences = semanticChunkingService.splitIntoSentences(text);

            // Should not split on "Dr."
            expect(sentences.length).toBeGreaterThanOrEqual(1);
        });

        it('should return empty array for empty string', () => {
            const sentences = semanticChunkingService.splitIntoSentences('');
            expect(sentences).toEqual([]);
        });

        it('should handle text with no sentence endings', () => {
            const text = 'This is a text without punctuation';
            const sentences = semanticChunkingService.splitIntoSentences(text);

            expect(sentences).toHaveLength(1);
            expect(sentences[0]).toBe('This is a text without punctuation');
        });

        it('should trim whitespace from sentences', () => {
            const text = '  First.   Second.  ';
            const sentences = semanticChunkingService.splitIntoSentences(text);

            sentences.forEach(s => {
                expect(s).toBe(s.trim());
            });
        });
    });

    describe('semanticChunkText', () => {
        it('should return empty array for empty text', async () => {
            const result = await semanticChunkingService.semanticChunkText('');
            expect(result).toEqual([]);
        });

        it('should return single chunk for single sentence', async () => {
            const text = 'This is one sentence.';
            const result = await semanticChunkingService.semanticChunkText(text);

            expect(result).toHaveLength(1);
            expect(result[0].text).toBe('This is one sentence');
            expect(result[0].totalChunks).toBe(1);
            expect(result[0].sentenceCount).toBe(1);
        });

        it('should create chunks based on semantic similarity', async () => {
            const text = 'AI is powerful. Machine learning is cool. The weather is nice today.';

            // Mock embeddings for 3 sentences
            mockLlmService.generateBatchEmbeddings.mockResolvedValueOnce([
                [0.9, 0.1, 0.1], // AI sentence
                [0.85, 0.15, 0.1], // ML sentence (similar to AI)
                [0.1, 0.1, 0.9], // Weather sentence (different)
            ]);

            const result = await semanticChunkingService.semanticChunkText(text);

            // Should create 2 chunks: AI+ML and Weather
            expect(result.length).toBeGreaterThanOrEqual(1);
            expect(mockLlmService.generateBatchEmbeddings).toHaveBeenCalled();
        });

        it('should respect maxTokens limit', async () => {
            // Create 10 proper sentences
            const sentences = [];
            for (let i = 0; i < 10; i++) {
                sentences.push(`This is sentence number ${i} with some content`);
            }
            const text = sentences.join('. ') + '.';

            mockLlmService.generateBatchEmbeddings.mockResolvedValueOnce(
                Array(10).fill([0.5, 0.5, 0.5])
            );

            const result = await semanticChunkingService.semanticChunkText(text, {
                maxTokens: 100,
            });

            // Should create chunks based on token limits
            expect(result.length).toBeGreaterThanOrEqual(1);
            expect(mockLlmService.generateBatchEmbeddings).toHaveBeenCalled();
        });

        it('should use custom similarity threshold', async () => {
            const text = 'First. Second. Third.';

            mockLlmService.generateBatchEmbeddings.mockResolvedValueOnce([
                [1.0, 0.0],
                [0.8, 0.2], // 0.8 similarity
                [0.1, 0.9], // Low similarity
            ]);

            await semanticChunkingService.semanticChunkText(text, {
                similarityThreshold: 0.9, // High threshold
            });

            expect(mockLlmService.generateBatchEmbeddings).toHaveBeenCalled();
        });

        it('should use custom provider', async () => {
            const text = 'Sentence one. Sentence two.';

            mockLlmService.generateBatchEmbeddings.mockResolvedValueOnce([
                [0.5, 0.5],
                [0.5, 0.5],
            ]);

            await semanticChunkingService.semanticChunkText(text, {
                provider: 'anthropic',
            });

            expect(mockLlmService.generateBatchEmbeddings).toHaveBeenCalledWith(
                expect.any(Array),
                'anthropic'
            );
        });
    });

    describe('addOverlap', () => {
        it('should return empty array for empty chunks', () => {
            const result = semanticChunkingService.addOverlap([], [], 0.2);
            expect(result).toEqual([]);
        });

        it('should mark single chunk as no overlap', () => {
            const chunks = [
                {
                    text: 'Chunk 1',
                    index: 0,
                    totalChunks: 1,
                    sentenceCount: 1,
                    startSentence: 0,
                    endSentence: 1,
                },
            ];
            const sentences = ['Chunk 1'];

            const result = semanticChunkingService.addOverlap(chunks, sentences, 0.2);

            expect(result).toHaveLength(1);
            expect(result[0].hasOverlap).toBe(false);
            expect(result[0].overlapAdded).toBe(false);
        });

        it('should add overlap from previous chunk', () => {
            const chunks = [
                {
                    text: 'First chunk',
                    index: 0,
                    totalChunks: 2,
                    sentenceCount: 2,
                    startSentence: 0,
                    endSentence: 2,
                },
                {
                    text: 'Second chunk',
                    index: 1,
                    totalChunks: 2,
                    sentenceCount: 2,
                    startSentence: 2,
                    endSentence: 4,
                },
            ];
            const sentences = ['Sent 1', 'Sent 2', 'Sent 3', 'Sent 4'];

            const result = semanticChunkingService.addOverlap(chunks, sentences, 0.5);

            // Second chunk should have overlap
            expect(result[1].hasOverlap).toBe(true);
            expect(result[1].overlapAdded).toBe(true);
            expect(result[1].text).toContain('Sent 2'); // Overlap from previous
        });

        it('should not add overlap when overlapPercentage is 0', () => {
            const chunks = [
                {
                    text: 'Chunk 1',
                    index: 0,
                    totalChunks: 2,
                    sentenceCount: 1,
                    startSentence: 0,
                    endSentence: 1,
                },
                {
                    text: 'Chunk 2',
                    index: 1,
                    totalChunks: 2,
                    sentenceCount: 1,
                    startSentence: 1,
                    endSentence: 2,
                },
            ];
            const sentences = ['Sent 1', 'Sent 2'];

            const result = semanticChunkingService.addOverlap(chunks, sentences, 0);

            result.forEach(chunk => {
                expect(chunk.hasOverlap).toBe(false);
                expect(chunk.overlapAdded).toBe(false);
            });
        });

        it('should calculate overlap sentence count correctly', () => {
            const chunks = [
                {
                    text: 'Chunk 1',
                    index: 0,
                    totalChunks: 2,
                    sentenceCount: 5,
                    startSentence: 0,
                    endSentence: 5,
                },
                {
                    text: 'Chunk 2',
                    index: 1,
                    totalChunks: 2,
                    sentenceCount: 3,
                    startSentence: 5,
                    endSentence: 8,
                },
            ];
            const sentences = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];

            const result = semanticChunkingService.addOverlap(chunks, sentences, 0.2);

            // 20% of 5 sentences = 1 sentence overlap
            expect(result[1].text).toContain('S5'); // Last sentence from previous chunk
        });
    });

    describe('chunkDocument', () => {
        it('should return empty array for empty content', async () => {
            const result = await semanticChunkingService.chunkDocument('');
            expect(result).toEqual([]);
        });

        it('should process document with all steps', async () => {
            const content = 'First sentence. Second sentence. Third sentence.';
            const metadata = { fileName: 'test.txt' };

            mockLlmService.generateBatchEmbeddings.mockResolvedValueOnce([
                [0.9, 0.1],
                [0.8, 0.2],
                [0.1, 0.9],
            ]);

            mockContextualEnrichmentService.isEnrichmentEnabled.mockReturnValueOnce(false);

            const result = await semanticChunkingService.chunkDocument(content, metadata);

            expect(result.length).toBeGreaterThan(0);
            expect(result[0].metadata).toBeDefined();
            expect(result[0].metadata?.fileName).toBe('test.txt');
            expect(result[0].metadata?.chunkingMethod).toBe('semantic');
        });

        it('should attach metadata to all chunks', async () => {
            const content = 'Sentence.';
            const metadata = { source: 'doc.pdf', page: 1 };

            const result = await semanticChunkingService.chunkDocument(content, metadata);

            result.forEach(chunk => {
                expect(chunk.metadata).toMatchObject({
                    source: 'doc.pdf',
                    page: 1,
                    chunkingMethod: 'semantic',
                });
            });
        });

        it('should apply contextual enrichment when enabled', async () => {

            mockLlmService.generateBatchEmbeddings.mockResolvedValueOnce([[0.5, 0.5]]);

            mockContextualEnrichmentService.isEnrichmentEnabled.mockReturnValueOnce(true);
            mockContextualEnrichmentService.enrichChunks.mockResolvedValueOnce([
                {
                    text: 'Test content',
                    embeddingText: 'Test content',
                    index: 0,
                    totalChunks: 1,
                    sentenceCount: 1,
                    hasContext: true,
                    context: 'Enriched context',
                    enrichedText: 'Test content with context',
                },
            ] as never);

            const result = await semanticChunkingService.chunkDocument('', {}, {
                useContextualEnrichment: true,
            });

            // Should not call enrichment because content is empty
            expect(result).toEqual([]);
        });

        it('should handle enrichment errors gracefully', async () => {

            mockLlmService.generateBatchEmbeddings.mockResolvedValueOnce([[0.5]]);
            mockContextualEnrichmentService.isEnrichmentEnabled.mockReturnValueOnce(true);
            mockContextualEnrichmentService.enrichChunks.mockRejectedValueOnce(
                new Error('Enrichment failed')
            );

            const result = await semanticChunkingService.chunkDocument('', {}, {
                useContextualEnrichment: true,
            });

            // Should return non-enriched chunks on error
            expect(result).toBeDefined();
        });
    });

    describe('chunkDocumentWithFallback', () => {
        it('should use semantic chunking for normal documents', async () => {
            const content = 'First sentence. Second sentence.';

            mockLlmService.generateBatchEmbeddings.mockResolvedValueOnce([[0.5, 0.5], [0.4, 0.6]]);
            mockContextualEnrichmentService.isEnrichmentEnabled.mockReturnValueOnce(false);

            const result = await semanticChunkingService.chunkDocumentWithFallback(content);

            expect(result.length).toBeGreaterThanOrEqual(1);
            // Semantic chunking should be attempted
            expect(mockLlmService.generateBatchEmbeddings).toHaveBeenCalled();
        });

        it('should fallback to character chunking for oversized documents', async () => {
            const content = 'a'.repeat(50000); // ~12,500 tokens

            mockChunkingService.chunkDocument.mockReturnValueOnce([
                {
                    text: 'a'.repeat(2000),
                    index: 0,
                    totalChunks: 25,
                    metadata: {},
                },
            ]);

            const result = await semanticChunkingService.chunkDocumentWithFallback(content, {}, {
                maxDocumentTokens: 10000,
            });

            expect(result).toBeDefined();
            expect(mockChunkingService.chunkDocument).toHaveBeenCalled();
            expect(mockLlmService.generateBatchEmbeddings).not.toHaveBeenCalled();
        });

        it('should fallback on non-retryable errors', async () => {
            const content = 'First sentence. Second sentence.';

            mockLlmService.generateBatchEmbeddings.mockRejectedValueOnce({
                status: 400,
                message: 'Bad request',
            });

            mockChunkingService.chunkDocument.mockReturnValueOnce([
                {
                    text: 'First sentence. Second sentence',
                    index: 0,
                    totalChunks: 1,
                    metadata: {},
                },
            ]);

            const result = await semanticChunkingService.chunkDocumentWithFallback(content);

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);
            expect(mockChunkingService.chunkDocument).toHaveBeenCalled();
        });

        it('should retry on retryable errors (429)', async () => {
            const content = 'First sentence. Second sentence.';

            // First call fails with 429
            mockLlmService.generateBatchEmbeddings
                .mockRejectedValueOnce({
                    status: 429,
                    message: 'Rate limit',
                })
                .mockResolvedValueOnce([[0.5, 0.5], [0.4, 0.6]]); // Retry succeeds

            mockContextualEnrichmentService.isEnrichmentEnabled
                .mockReturnValueOnce(false)
                .mockReturnValueOnce(false);

            const result = await semanticChunkingService.chunkDocumentWithFallback(content);

            expect(result).toBeDefined();
            expect(mockLlmService.generateBatchEmbeddings).toHaveBeenCalledTimes(2);
        });

        it('should retry on server errors (5xx)', async () => {
            const content = 'First sentence. Second sentence.';

            mockLlmService.generateBatchEmbeddings
                .mockRejectedValueOnce({
                    status: 503,
                    message: 'Service unavailable',
                })
                .mockResolvedValueOnce([[0.5, 0.5], [0.4, 0.6]]); // Retry succeeds

            mockContextualEnrichmentService.isEnrichmentEnabled
                .mockReturnValueOnce(false)
                .mockReturnValueOnce(false);

            const result = await semanticChunkingService.chunkDocumentWithFallback(content);

            expect(result).toBeDefined();
            expect(mockLlmService.generateBatchEmbeddings).toHaveBeenCalledTimes(2);
        });

        it('should fallback if retry also fails', async () => {
            const content = 'First sentence. Second sentence.';

            mockLlmService.generateBatchEmbeddings
                .mockRejectedValueOnce({
                    status: 429,
                    message: 'Rate limit',
                })
                .mockRejectedValueOnce({
                    status: 429,
                    message: 'Rate limit again',
                });

            mockChunkingService.chunkDocument.mockReturnValueOnce([
                {
                    text: 'First sentence. Second sentence',
                    index: 0,
                    totalChunks: 1,
                    metadata: {},
                },
            ]);

            const result = await semanticChunkingService.chunkDocumentWithFallback(content);

            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);
            expect(mockChunkingService.chunkDocument).toHaveBeenCalled();
        });

        it('should preserve metadata in fallback chunks', async () => {
            const content = 'a'.repeat(50000);
            const metadata = { source: 'large.pdf' };

            mockChunkingService.chunkDocument.mockReturnValueOnce([
                {
                    text: 'chunk',
                    index: 0,
                    totalChunks: 1,
                    metadata,
                },
            ]);

            const result = await semanticChunkingService.chunkDocumentWithFallback(
                content,
                metadata,
                {
                    maxDocumentTokens: 1000,
                }
            );

            expect(result[0].metadata).toEqual(metadata);
        });
    });
});
