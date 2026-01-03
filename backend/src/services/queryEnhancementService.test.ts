import queryEnhancementService from './queryEnhancementService';
import llmService from './llmService';

jest.mock('./llmService');
jest.mock('../config/logger');
jest.mock('../config/appConfig', () => ({
    __esModule: true,
    default: {
        chunking: {
            charactersPerToken: 4,
            maxTokensPerChunk: 500,
            overlapTokens: 50,
        },
        ragOptimization: {
            queryEnhancement: {
                enabled: true,
                useConversationContext: true,
                useHyDE: true,
                useMultiQuery: true,
                queryVariants: 3,
                maxContextMessages: 5,
                hydePromptTemplate: 'Write a detailed answer to: {{QUERY}}',
                multiQueryPromptTemplate: 'Generate {{COUNT}} variations of: {{QUERY}}',
                contextInjectionTemplate: 'History: {{HISTORY}}\nQuery: {{QUERY}}',
            },
        },
    },
}));

const mockLlmService = llmService as jest.Mocked<typeof llmService>;

describe('QueryEnhancementService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateHyDE', () => {
        it('should generate hypothetical document', async () => {
            const mockResponse = {
                content: 'This is a hypothetical answer document.',
                metadata: {},
            };
            mockLlmService.generateResponse.mockResolvedValueOnce(mockResponse);

            const result = await queryEnhancementService.generateHyDE('What is RAG?');

            expect(result).toBe('This is a hypothetical answer document.');
            expect(mockLlmService.generateResponse).toHaveBeenCalledWith(
                'openai',
                'gpt-4o-mini',
                [],
                expect.stringContaining('What is RAG?'),
                0.7,
                300
            );
        });

        it('should use custom options for HyDE generation', async () => {
            const mockResponse = {
                content: '  HyDE document with whitespace  ',
                metadata: {},
            };
            mockLlmService.generateResponse.mockResolvedValueOnce(mockResponse);

            const result = await queryEnhancementService.generateHyDE('Query', {
                provider: 'anthropic',
                model: 'claude-3-sonnet',
                temperature: 0.5,
            });

            expect(result).toBe('HyDE document with whitespace');
            expect(mockLlmService.generateResponse).toHaveBeenCalledWith(
                'anthropic',
                'claude-3-sonnet',
                [],
                expect.any(String),
                0.5,
                300
            );
        });

        it('should throw error if HyDE generation fails', async () => {
            const error = new Error('LLM API error');
            mockLlmService.generateResponse.mockRejectedValueOnce(error);

            await expect(
                queryEnhancementService.generateHyDE('Query')
            ).rejects.toThrow('LLM API error');
        });

        it('should replace template placeholder with query', async () => {
            const mockResponse = { content: 'Response', metadata: {} };
            mockLlmService.generateResponse.mockResolvedValueOnce(mockResponse);

            await queryEnhancementService.generateHyDE('Test query');

            expect(mockLlmService.generateResponse).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                [],
                'Write a detailed answer to: Test query',
                expect.any(Number),
                expect.any(Number)
            );
        });
    });

    describe('generateQueryVariants', () => {
        it('should generate query variants from JSON response', async () => {
            const mockResponse = {
                content: '["What is RAG?", "Explain RAG", "Define RAG"]',
                metadata: {},
            };
            mockLlmService.generateResponse.mockResolvedValueOnce(mockResponse);

            const result = await queryEnhancementService.generateQueryVariants('What is RAG?');

            expect(result).toEqual(['What is RAG?', 'Explain RAG', 'Define RAG']);
            expect(mockLlmService.generateResponse).toHaveBeenCalled();
        });

        it('should parse JSON from markdown code blocks', async () => {
            const mockResponse = {
                content: '```json\n["variant 1", "variant 2", "variant 3"]\n```',
                metadata: {},
            };
            mockLlmService.generateResponse.mockResolvedValueOnce(mockResponse);

            const result = await queryEnhancementService.generateQueryVariants('Query');

            expect(result).toEqual(['variant 1', 'variant 2', 'variant 3']);
        });

        it('should handle line-by-line variant responses', async () => {
            const mockResponse = {
                content: '- What is AI?\n- Explain AI\n- Define AI',
                metadata: {},
            };
            mockLlmService.generateResponse.mockResolvedValueOnce(mockResponse);

            const result = await queryEnhancementService.generateQueryVariants('What is AI?', {
                count: 3,
            });

            expect(result).toEqual(['What is AI?', 'Explain AI', 'Define AI']);
            expect(result.length).toBeLessThanOrEqual(3);
        });

        it('should handle numbered list responses', async () => {
            const mockResponse = {
                content: '1. First variant\n2. Second variant\n3. Third variant',
                metadata: {},
            };
            mockLlmService.generateResponse.mockResolvedValueOnce(mockResponse);

            const result = await queryEnhancementService.generateQueryVariants('Query');

            expect(result.length).toBeGreaterThan(0);
            expect(result[0]).toBe('1. First variant');
        });

        it('should use custom count option', async () => {
            const mockResponse = {
                content: '["v1", "v2", "v3", "v4", "v5"]',
                metadata: {},
            };
            mockLlmService.generateResponse.mockResolvedValueOnce(mockResponse);

            await queryEnhancementService.generateQueryVariants('Query', {
                count: 5,
            });

            expect(mockLlmService.generateResponse).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                [],
                expect.stringContaining('Generate 5'),
                expect.any(Number),
                expect.any(Number)
            );
        });

        it('should fallback to parsing lines on JSON parse error', async () => {
            const mockResponse = {
                content: 'Invalid JSON response',
                metadata: {},
            };
            mockLlmService.generateResponse.mockResolvedValueOnce(mockResponse);

            const result = await queryEnhancementService.generateQueryVariants('Original query');

            // Service tries to parse as lines when JSON fails
            expect(result.length).toBeGreaterThanOrEqual(1);
            expect(result[0]).toBe('Invalid JSON response');
        });

        it('should return original query on LLM error', async () => {
            mockLlmService.generateResponse.mockRejectedValueOnce(new Error('API error'));

            const result = await queryEnhancementService.generateQueryVariants('Query');

            expect(result).toEqual(['Query']);
        });

        it('should use custom provider and model', async () => {
            const mockResponse = { content: '["v1"]', metadata: {} };
            mockLlmService.generateResponse.mockResolvedValueOnce(mockResponse);

            await queryEnhancementService.generateQueryVariants('Query', {
                provider: 'anthropic',
                model: 'claude-3-opus',
            });

            expect(mockLlmService.generateResponse).toHaveBeenCalledWith(
                'anthropic',
                'claude-3-opus',
                [],
                expect.any(String),
                0.8,
                200
            );
        });

        it('should strip quotes from variants', async () => {
            const mockResponse = {
                content: '"Query 1"\n"Query 2"\n"Query 3"',
                metadata: {},
            };
            mockLlmService.generateResponse.mockResolvedValueOnce(mockResponse);

            const result = await queryEnhancementService.generateQueryVariants('Q');

            result.forEach(variant => {
                expect(variant).not.toMatch(/^["']|["']$/);
            });
        });
    });

    describe('enhanceQueryWithContext', () => {
        it('should return original query if no history', async () => {
            const result = await queryEnhancementService.enhanceQueryWithContext('Query', []);

            expect(result).toBe('Query');
            expect(mockLlmService.generateResponse).not.toHaveBeenCalled();
        });

        it('should enhance query with conversation history', async () => {
            const history = [
                { sender: 'user', content: 'What is AI?' },
                { sender: 'assistant', content: 'AI stands for Artificial Intelligence.' },
                { sender: 'user', content: 'Tell me more' },
            ];

            const mockResponse = {
                content: 'Tell me more about Artificial Intelligence',
                metadata: {},
            };
            mockLlmService.generateResponse.mockResolvedValueOnce(mockResponse);

            const result = await queryEnhancementService.enhanceQueryWithContext(
                'Tell me more',
                history
            );

            expect(result).toBe('Tell me more about Artificial Intelligence');
            expect(mockLlmService.generateResponse).toHaveBeenCalledWith(
                'openai',
                'gpt-4o-mini',
                [],
                expect.stringContaining('user: What is AI?'),
                0.3,
                150
            );
        });

        it('should limit history to maxHistoryMessages', async () => {
            const longHistory = [
                { sender: 'user', content: 'Message 1' },
                { sender: 'assistant', content: 'Response 1' },
                { sender: 'user', content: 'Message 2' },
                { sender: 'assistant', content: 'Response 2' },
                { sender: 'user', content: 'Message 3' },
                { sender: 'assistant', content: 'Response 3' },
                { sender: 'user', content: 'Message 4' },
                { sender: 'assistant', content: 'Response 4' },
            ];

            const mockResponse = { content: 'Enhanced', metadata: {} };
            mockLlmService.generateResponse.mockResolvedValueOnce(mockResponse);

            await queryEnhancementService.enhanceQueryWithContext('Query', longHistory, {
                maxHistoryMessages: 3,
            });

            const callArgs = mockLlmService.generateResponse.mock.calls[0][3] as string;
            // Should only include last 3 messages (slice(-3))
            expect(callArgs).toContain('Response 3'); // Message 6
            expect(callArgs).toContain('Message 4'); // Message 7
            expect(callArgs).toContain('Response 4'); // Message 8
            expect(callArgs).not.toContain('Message 1');
        });

        it('should fallback to original query on error', async () => {
            const history = [{ sender: 'user', content: 'Previous message' }];
            mockLlmService.generateResponse.mockRejectedValueOnce(new Error('API error'));

            const result = await queryEnhancementService.enhanceQueryWithContext(
                'Current query',
                history,
                { fallbackToOriginal: true }
            );

            expect(result).toBe('Current query');
        });

        it('should throw error when fallbackToOriginal is false', async () => {
            const history = [{ sender: 'user', content: 'Previous' }];
            mockLlmService.generateResponse.mockRejectedValueOnce(new Error('API error'));

            await expect(
                queryEnhancementService.enhanceQueryWithContext('Query', history, {
                    fallbackToOriginal: false,
                })
            ).rejects.toThrow('API error');
        });

        it('should trim enhanced query result', async () => {
            const history = [{ sender: 'user', content: 'Previous' }];
            const mockResponse = { content: '  Enhanced query  ', metadata: {} };
            mockLlmService.generateResponse.mockResolvedValueOnce(mockResponse);

            const result = await queryEnhancementService.enhanceQueryWithContext(
                'Query',
                history
            );

            expect(result).toBe('Enhanced query');
        });
    });

    describe('enhanceQuery', () => {
        it('should run full enhancement pipeline', async () => {
            const history = [
                { sender: 'user', content: 'What is AI?' },
                { sender: 'assistant', content: 'AI is...' },
            ];

            // Mock context injection
            mockLlmService.generateResponse.mockResolvedValueOnce({
                content: 'Enhanced: Tell me more about AI',
                metadata: {},
            });

            // Mock HyDE generation
            mockLlmService.generateResponse.mockResolvedValueOnce({
                content: 'Hypothetical document about AI',
                metadata: {},
            });

            // Mock query variants
            mockLlmService.generateResponse.mockResolvedValueOnce({
                content: '["variant 1", "variant 2", "variant 3"]',
                metadata: {},
            });

            const result = await queryEnhancementService.enhanceQuery(
                'Tell me more',
                history,
                {
                    useContextInjection: true,
                    useHyDE: true,
                    useMultiQuery: true,
                }
            );

            expect(result.originalQuery).toBe('Tell me more');
            expect(result.enhancedQuery).toBe('Enhanced: Tell me more about AI');
            expect(result.hydeDocument).toBe('Hypothetical document about AI');
            expect(result.queryVariants).toHaveLength(3);
            expect(mockLlmService.generateResponse).toHaveBeenCalledTimes(3);
        });

        it('should skip context injection when disabled', async () => {
            const result = await queryEnhancementService.enhanceQuery('Query', [], {
                useContextInjection: false,
                useHyDE: false,
                useMultiQuery: false,
            });

            expect(result.enhancedQuery).toBe('Query');
            expect(result.hydeDocument).toBeNull();
            expect(result.queryVariants).toEqual(['Query']);
            expect(mockLlmService.generateResponse).not.toHaveBeenCalled();
        });

        it('should skip context injection when no history', async () => {
            const result = await queryEnhancementService.enhanceQuery('Query', [], {
                useContextInjection: true,
            });

            expect(result.enhancedQuery).toBe('Query');
        });

        it('should continue pipeline even if context injection fails', async () => {
            const history = [{ sender: 'user', content: 'Previous' }];

            // Context injection fails
            mockLlmService.generateResponse.mockRejectedValueOnce(new Error('Context error'));

            // HyDE succeeds
            mockLlmService.generateResponse.mockResolvedValueOnce({
                content: 'HyDE doc',
                metadata: {},
            });

            const result = await queryEnhancementService.enhanceQuery('Query', history, {
                useContextInjection: true,
                useHyDE: true,
                useMultiQuery: false,
                fallbackOnError: true,
            });

            expect(result.enhancedQuery).toBe('Query'); // Fallback
            expect(result.hydeDocument).toBe('HyDE doc'); // Succeeded
        });

        it('should continue pipeline even if HyDE fails', async () => {
            // HyDE fails
            mockLlmService.generateResponse.mockRejectedValueOnce(new Error('HyDE error'));

            // Query variants succeed
            mockLlmService.generateResponse.mockResolvedValueOnce({
                content: '["v1", "v2"]',
                metadata: {},
            });

            const result = await queryEnhancementService.enhanceQuery('Query', [], {
                useHyDE: true,
                useMultiQuery: true,
                fallbackOnError: true,
            });

            expect(result.hydeDocument).toBeNull();
            expect(result.queryVariants).toEqual(['v1', 'v2']);
        });

        it('should continue pipeline even if variant generation fails', async () => {
            // Variants fail
            mockLlmService.generateResponse.mockRejectedValueOnce(new Error('Variant error'));

            const result = await queryEnhancementService.enhanceQuery('Query', [], {
                useMultiQuery: true,
                fallbackOnError: true,
            });

            expect(result.queryVariants).toEqual(['Query']); // Fallback
        });

        it('should throw error when fallbackOnError is false', async () => {
            mockLlmService.generateResponse.mockRejectedValueOnce(new Error('Fatal error'));

            await expect(
                queryEnhancementService.enhanceQuery('Query', [], {
                    useHyDE: true,
                    fallbackOnError: false,
                })
            ).rejects.toThrow('Fatal error');
        });

        it('should return fallback result on pipeline error', async () => {
            // Cause error in pipeline
            mockLlmService.generateResponse.mockImplementation(() => {
                throw new Error('Unexpected error');
            });

            const result = await queryEnhancementService.enhanceQuery('Original', [], {
                useHyDE: true,
                fallbackOnError: true,
            });

            expect(result).toEqual({
                originalQuery: 'Original',
                enhancedQuery: 'Original',
                hydeDocument: null,
                queryVariants: ['Original'],
            });
        });
    });

    describe('getAllSearchQueries', () => {
        it('should extract all unique queries', () => {
            const enhancedResult = {
                originalQuery: 'Original',
                enhancedQuery: 'Enhanced',
                hydeDocument: 'HyDE doc',
                queryVariants: ['Variant 1', 'Variant 2'],
            };

            const result = queryEnhancementService.getAllSearchQueries(enhancedResult);

            expect(result).toContain('Enhanced');
            expect(result).toContain('HyDE doc');
            expect(result).toContain('Variant 1');
            expect(result).toContain('Variant 2');
            expect(result.length).toBe(4);
        });

        it('should remove duplicates', () => {
            const enhancedResult = {
                originalQuery: 'Query',
                enhancedQuery: 'Query',
                hydeDocument: 'Query',
                queryVariants: ['Query', 'Different'],
            };

            const result = queryEnhancementService.getAllSearchQueries(enhancedResult);

            expect(result).toEqual(['Query', 'Different']);
        });

        it('should filter out empty queries', () => {
            const enhancedResult = {
                originalQuery: 'Original',
                enhancedQuery: '',
                hydeDocument: null,
                queryVariants: ['Valid', '', '  ', 'Another'],
            };

            const result = queryEnhancementService.getAllSearchQueries(enhancedResult);

            // Empty enhancedQuery and whitespace-only strings are filtered out
            // originalQuery is only added if queries array is empty, so not included here
            expect(result).toEqual(['Valid', 'Another']);
        });

        it('should fallback to originalQuery if all others empty', () => {
            const enhancedResult = {
                originalQuery: 'Fallback',
                enhancedQuery: '',
                hydeDocument: null,
                queryVariants: [],
            };

            const result = queryEnhancementService.getAllSearchQueries(enhancedResult);

            expect(result).toEqual(['Fallback']);
        });

        it('should handle missing queryVariants array', () => {
            const enhancedResult = {
                originalQuery: 'Original',
                enhancedQuery: 'Enhanced',
                hydeDocument: null,
                queryVariants: null as never,
            };

            const result = queryEnhancementService.getAllSearchQueries(enhancedResult);

            expect(result).toContain('Enhanced');
        });

        it('should include queries with leading/trailing whitespace', () => {
            const enhancedResult = {
                originalQuery: 'Original',
                enhancedQuery: '  Enhanced  ',
                hydeDocument: '  HyDE  ',
                queryVariants: ['  Variant  '],
            };

            const result = queryEnhancementService.getAllSearchQueries(enhancedResult);

            // getAllSearchQueries doesn't trim, it just filters empty strings
            expect(result).toContain('  Enhanced  ');
            expect(result).toContain('  HyDE  ');
            expect(result).toContain('  Variant  ');
        });
    });

    describe('isEnhancementEnabled', () => {
        it('should return true when enhancement is enabled', () => {
            const result = queryEnhancementService.isEnhancementEnabled();
            expect(result).toBe(true);
        });
    });
});
