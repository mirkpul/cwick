import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock the external libraries
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

// Mock instances
const mockOpenAI = {
    chat: {
        completions: {
            create: jest.fn(),
        },
    },
    embeddings: {
        create: jest.fn(),
    },
};

const mockAnthropic = {
    messages: {
        create: jest.fn(),
    },
};

const mockGemini = {
    getGenerativeModel: jest.fn(),
};

const mockGenerativeModel = {
    generateContent: jest.fn(),
    generateContentStream: jest.fn(),
    startChat: jest.fn(),
};

const mockChatSession = {
    sendMessage: jest.fn(),
    sendMessageStream: jest.fn(),
};

// Setup mocks for constructors
(OpenAI as unknown as jest.Mock).mockImplementation(() => mockOpenAI);
(Anthropic as unknown as jest.Mock).mockImplementation(() => mockAnthropic);
(GoogleGenerativeAI as unknown as jest.Mock).mockImplementation(() => mockGemini);

import llmService from './llmService';

describe('LLMService - Comprehensive Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGemini.getGenerativeModel.mockReturnValue(mockGenerativeModel);
        mockGenerativeModel.startChat.mockReturnValue(mockChatSession);
    });

    describe('generateResponse', () => {
        it('should generate response with OpenAI provider', async () => {
            const mockResponse = {
                model: 'gpt-4',
                choices: [{
                    message: { content: 'Test response' },
                    finish_reason: 'stop',
                }],
                usage: {
                    prompt_tokens: 50,
                    completion_tokens: 50,
                    total_tokens: 100
                },
            };

            mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

            const messages = [{ role: 'user' as const, sender: 'user' as const, content: 'Hello' }];
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
            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(expect.objectContaining({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: 'You are helpful' },
                    { role: 'user', content: 'Hello' },
                ],
                temperature: 0.7,
                max_tokens: 1000,
            }));
        });

        it('should generate response with Anthropic provider', async () => {
            const mockResponse = {
                model: 'claude-3-sonnet',
                content: [{ type: 'text', text: 'Anthropic response' }],
                usage: {
                    input_tokens: 75,
                    output_tokens: 75,
                },
                stop_reason: 'end_turn',
            };

            mockAnthropic.messages.create.mockResolvedValueOnce(mockResponse);

            const messages = [{ role: 'user' as const, sender: 'user' as const, content: 'Hello API' }];
            const result = await llmService.generateResponse(
                'anthropic',
                'claude-3-sonnet',
                messages,
                'Be concise',
                0.5,
                500
            );

            expect(result.content).toBe('Anthropic response');
            expect(mockAnthropic.messages.create).toHaveBeenCalledWith(expect.objectContaining({
                model: 'claude-3-sonnet',
                system: 'Be concise',
                temperature: 0.5,
                max_tokens: 500,
                messages: [{ role: 'user', content: 'Hello API' }],
            }));
        });

        it('should generate response with Gemini provider', async () => {
            const mockResponse = {
                response: {
                    text: () => 'Gemini response',
                },
            };

            mockChatSession.sendMessage.mockResolvedValueOnce(mockResponse);

            const messages = [{ role: 'user' as const, sender: 'user' as const, content: 'Gemini?' }];
            const result = await llmService.generateResponse(
                'gemini',
                'gemini-pro',
                messages
            );

            expect(result.content).toBe('Gemini response');
            expect(mockGemini.getGenerativeModel).toHaveBeenCalledWith(expect.objectContaining({
                model: 'gemini-pro'
            }));
        });

        it('should handle numeric strings for temperature and maxTokens', async () => {
            mockOpenAI.chat.completions.create.mockResolvedValueOnce({
                model: 'gpt-4',
                choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }],
            });

            const messages = [{ role: 'user' as const, content: 'Test' }];
            await llmService.generateResponse(
                'openai',
                'gpt-4',
                messages,
                undefined,
                '0.8',
                '1500'
            );

            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    temperature: 0.8,
                    max_tokens: 1500,
                })
            );
        });
    });

    describe('generateEmbedding', () => {
        it('should generate embedding successfully', async () => {
            const mockEmbedding = Array(1536).fill(0.1);
            mockOpenAI.embeddings.create.mockResolvedValueOnce({
                data: [{ embedding: mockEmbedding }],
                model: 'text-embedding-3-small',
                usage: { prompt_tokens: 10, total_tokens: 10 },
            });

            const result = await llmService.generateEmbedding('Test text', 'openai');

            expect(result).toEqual(mockEmbedding);
            expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
                model: 'text-embedding-3-small',
                input: 'Test text',
            });
        });

        it('should throw error for unsupported provider', async () => {
            await expect(
                llmService.generateEmbedding('Test', 'gemini' as never)
            ).rejects.toThrow('Embeddings not supported for provider');
        });
    });

    describe('generateBatchEmbeddings', () => {
        it('should generate batch embeddings successfully', async () => {
            const texts = ['Text 1', 'Text 2'];
            const mockEmbeddings = [
                Array(1536).fill(0.1),
                Array(1536).fill(0.2),
            ];

            mockOpenAI.embeddings.create.mockResolvedValueOnce({
                data: mockEmbeddings.map(emb => ({ embedding: emb })),
                model: 'text-embedding-3-small',
            });

            const result = await llmService.generateBatchEmbeddings(texts, 'openai');

            expect(result).toEqual(mockEmbeddings);
        });

        it('should handle empty array', async () => {
            const result = await llmService.generateBatchEmbeddings([], 'openai');
            expect(result).toEqual([]);
        });
    });

    describe('generateStreamingResponse', () => {
        it('should support streaming for OpenAI', async () => {
            const mockStream = (async function* () {
                yield { choices: [{ delta: { content: 'Hello' } }], model: 'gpt-4' };
                yield { choices: [{ delta: { content: ' world' }, finish_reason: 'stop' }], model: 'gpt-4' };
            })();

            mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockStream);

            const onChunk = jest.fn();
            const result = await llmService.generateStreamingResponse(
                'openai',
                'gpt-4',
                [{ role: 'user', content: 'Hi' }],
                '',
                onChunk
            );

            expect(result.content).toBe('Hello world');
            expect(onChunk).toHaveBeenCalledTimes(2);
            expect(onChunk).toHaveBeenCalledWith('Hello');
            expect(onChunk).toHaveBeenCalledWith(' world');
        });
    });
});
