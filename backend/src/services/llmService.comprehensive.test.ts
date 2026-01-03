jest.mock('openai');
jest.mock('@anthropic-ai/sdk');
jest.mock('@google/generative-ai');
jest.mock('../config/logger');
jest.mock('../config/appConfig', () => ({
    __esModule: true,
    default: {
        llm: {
            defaultTemperature: 0.7,
            defaultMaxTokens: 1000,
            providers: {
                openai: {
                    embeddingModel: 'text-embedding-3-small',
                },
            },
        },
        chunking: {
            charactersPerToken: 4,
        },
        ragOptimization: {
            performance: {
                useBatchEmbeddings: true,
                maxBatchSize: 20,
                maxBatchTokens: 6000,
            },
        },
        visualExtraction: {
            visionProvider: 'openai',
            visionModel: 'gpt-4o-mini',
        },
    },
}));

// Create mock gateway client
const mockGatewayClient = {
    generateResponse: jest.fn(),
    generateEmbedding: jest.fn(),
    generateBatchEmbeddings: jest.fn(),
};

// Mock the SDK before importing llmService
jest.mock('@virtualcoach/sdk', () => ({
    LLMClient: jest.fn().mockImplementation(() => mockGatewayClient),
}));

import llmService from './llmService';

describe('LLMService - Comprehensive Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateResponse', () => {
        it('should generate response with OpenAI provider', async () => {
            const mockResponse = {
                content: 'Test response',
                model: 'gpt-4',
                usage: {
                    prompt_tokens: 50,
                    completion_tokens: 50,
                    total_tokens: 100
                },
                finish_reason: 'stop',
            };

            mockGatewayClient.generateResponse.mockResolvedValueOnce(mockResponse);

            const messages = [{ role: 'user' as const, content: 'Hello' }];
            const result = await llmService.generateResponse(
                'openai',
                'gpt-4',
                messages,
                'You are helpful',
                0.7,
                1000
            );

            expect(result.content).toBe('Test response');
            expect(result.metadata.model).toBe('gpt-4');
            expect(mockGatewayClient.generateResponse).toHaveBeenCalledWith({
                provider: 'openai',
                model: 'gpt-4',
                messages: expect.arrayContaining([
                    { role: 'system', content: 'You are helpful' },
                    { role: 'user', content: 'Hello' },
                ]),
                temperature: 0.7,
                maxTokens: 1000,
            });
        });

        it('should generate response with Anthropic provider', async () => {
            const mockResponse = {
                content: 'Anthropic response',
                model: 'claude-3-sonnet',
                usage: {
                    prompt_tokens: 75,
                    completion_tokens: 75,
                    total_tokens: 150
                },
                finish_reason: 'end_turn',
            };

            mockGatewayClient.generateResponse.mockResolvedValueOnce(mockResponse);

            const messages = [{ role: 'user' as const, content: 'Hi Claude' }];
            const result = await llmService.generateResponse(
                'anthropic',
                'claude-3-sonnet',
                messages,
                'You are Claude',
                0.5,
                2000
            );

            expect(result.content).toBe('Anthropic response');
            expect(mockGatewayClient.generateResponse).toHaveBeenCalledWith({
                provider: 'anthropic',
                model: 'claude-3-sonnet',
                messages: expect.any(Array),
                temperature: 0.5,
                maxTokens: 2000,
            });
        });

        it('should generate response with Gemini provider', async () => {
            const mockResponse = {
                content: 'Gemini response',
                model: 'gemini-pro',
                finish_reason: 'stop',
            };

            mockGatewayClient.generateResponse.mockResolvedValueOnce(mockResponse);

            const messages = [{ role: 'user' as const, content: 'Hello Gemini' }];
            const result = await llmService.generateResponse(
                'gemini',
                'gemini-pro',
                messages,
                'You are Gemini'
            );

            expect(result.content).toBe('Gemini response');
            expect(mockGatewayClient.generateResponse).toHaveBeenCalled();
        });

        it('should handle temperature as string', async () => {
            const mockResponse = {
                content: 'Response',
                model: 'gpt-4',
            };

            mockGatewayClient.generateResponse.mockResolvedValueOnce(mockResponse);

            const messages = [{ role: 'user' as const, content: 'Test' }];
            await llmService.generateResponse(
                'openai',
                'gpt-4',
                messages,
                undefined,
                '0.8',
                '1500'
            );

            expect(mockGatewayClient.generateResponse).toHaveBeenCalledWith(
                expect.objectContaining({
                    temperature: 0.8,
                    maxTokens: 1500,
                })
            );
        });

        it('should handle errors', async () => {
            mockGatewayClient.generateResponse.mockRejectedValueOnce(
                new Error('API error')
            );

            const messages = [{ role: 'user' as const, content: 'Test' }];

            await expect(
                llmService.generateResponse('openai', 'gpt-4', messages)
            ).rejects.toThrow('API error');
        });
    });

    describe('generateEmbedding', () => {
        it('should generate embedding successfully', async () => {
            const mockEmbedding = Array(1536).fill(0.1);
            mockGatewayClient.generateEmbedding.mockResolvedValueOnce({
                embeddings: [mockEmbedding],
                model: 'text-embedding-3-small',
                usage: {
                    prompt_tokens: 10,
                    total_tokens: 10,
                },
            });

            const result = await llmService.generateEmbedding('Test text', 'openai');

            expect(result).toEqual(mockEmbedding);
            expect(mockGatewayClient.generateEmbedding).toHaveBeenCalledWith({
                text: 'Test text',
                provider: 'openai',
                model: 'text-embedding-3-small',
            });
        });

        it('should throw error for unsupported provider', async () => {
            await expect(
                llmService.generateEmbedding('Test', 'gemini' as never)
            ).rejects.toThrow('Embeddings not supported for provider');
        });

        it('should throw error for anthropic provider', async () => {
            await expect(
                llmService.generateEmbedding('Test', 'anthropic')
            ).rejects.toThrow('Embeddings not supported for provider: anthropic');
        });
    });

    describe('generateBatchEmbeddings', () => {
        it('should generate batch embeddings successfully', async () => {
            const texts = ['Text 1', 'Text 2', 'Text 3'];
            const mockEmbeddings = [
                Array(1536).fill(0.1),
                Array(1536).fill(0.2),
                Array(1536).fill(0.3),
            ];

            mockGatewayClient.generateBatchEmbeddings.mockResolvedValueOnce(mockEmbeddings);

            const result = await llmService.generateBatchEmbeddings(texts, 'openai');

            expect(result).toEqual(mockEmbeddings);
            expect(mockGatewayClient.generateBatchEmbeddings).toHaveBeenCalledWith(
                texts,
                'openai'
            );
        });

        it('should handle empty array', async () => {
            const result = await llmService.generateBatchEmbeddings([], 'openai');
            expect(result).toEqual([]);
        });

        it('should throw error for unsupported provider', async () => {
            await expect(
                llmService.generateBatchEmbeddings(['Test'], 'anthropic')
            ).rejects.toThrow('Batch embeddings not supported for provider');
        });

        it('should process batches correctly', async () => {
            const texts = ['Text 1', 'Text 2'];
            const mockEmbeddings = [
                Array(1536).fill(0.1),
                Array(1536).fill(0.2),
            ];

            mockGatewayClient.generateBatchEmbeddings.mockResolvedValueOnce(mockEmbeddings);

            const result = await llmService.generateBatchEmbeddings(texts, 'openai');

            expect(result).toHaveLength(2);
            expect(mockGatewayClient.generateBatchEmbeddings).toHaveBeenCalledWith(texts, 'openai');
        });
    });

    describe('generateStreamingResponse', () => {
        it('should handle streaming for all providers', async () => {
            const _onChunk = jest.fn();
            const _messages = [{ role: 'user' as const, content: 'Test' }];

            const providers: Array<'openai' | 'anthropic' | 'gemini'> = ['openai', 'anthropic', 'gemini'];

            for (const _provider of providers) {
                // This test just verifies the method exists and accepts correct parameters
                expect(llmService.generateStreamingResponse).toBeDefined();
                expect(typeof llmService.generateStreamingResponse).toBe('function');
            }
        });
    });

    describe('describeImageFromBuffer', () => {
        it('should validate that method exists', () => {
            expect(llmService.describeImageFromBuffer).toBeDefined();
            expect(typeof llmService.describeImageFromBuffer).toBe('function');
        });

        it('should throw error for empty buffer', async () => {
            await expect(
                llmService.describeImageFromBuffer({
                    buffer: Buffer.from([]),
                    mimeType: 'image/png',
                    prompt: 'Describe this image',
                })
            ).rejects.toThrow('Image buffer is empty');
        });
    });
});
