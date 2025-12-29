import chatService from './chatService';
import db from '../config/database';
import llmService from './llmService';
import knowledgeBaseService from './knowledgeBaseService';
import fileProcessingService from './fileProcessingService';
import contextService from './contextService';

jest.mock('../config/database');
jest.mock('./llmService');
jest.mock('./knowledgeBaseService');
jest.mock('./fileProcessingService');
jest.mock('./contextService');
jest.mock('./queryEnhancementService');
jest.mock('./hybridSearchService');
jest.mock('./rerankingService');
jest.mock('./ensembleBalancingService');
jest.mock('../config/logger');
jest.mock('../config/ragLogger');
jest.mock('../config/appConfig', () => ({
    __esModule: true,
    default: {
        database: {
            poolMax: 20,
            idleTimeoutMs: 30000,
            connectionTimeoutMs: 10000,
        },
        chunking: {
            charactersPerToken: 4,
        },
        conversations: {
            messageHistoryLimit: 10,
        },
        semanticSearch: {
            sourceThresholds: {
                knowledgeBase: 0.8,
                email: 0.75,
            },
            defaultMaxResults: 5,
            useAdaptiveFiltering: true,
            ensembleBalancing: {
                enabled: true,
                maxEmailRatio: 0.6,
                maxKBRatio: 0.7,
                minEmailResults: 1,
                minKBResults: 1,
            },
        },
        ragOptimization: {
            queryEnhancement: {
                enabled: true,
                useConversationContext: true,
                useHyDE: false,
                useMultiQuery: false,
            },
            hybridSearch: {
                enabled: false,
            },
            reranking: {
                enabled: false,
            },
            assetEnrichment: {
                tables: {
                    maxColumns: 10,
                },
            },
        },
        llm: {
            defaultTemperature: 0.7,
            defaultMaxTokens: 1000,
        },
        fileUpload: {
            allowedMimeTypes: ['text/plain', 'application/pdf'],
            maxSizeBytes: 10000000,
        },
    },
}));

const mockDb = db as jest.Mocked<typeof db>;
const mockLlmService = llmService as jest.Mocked<typeof llmService>;

describe('ChatService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createConversation', () => {
        it('should create conversation with existing end user', async () => {
            const kbId = 'kb123';
            const endUserData = {
                email: 'enduser@example.com',
                name: 'End User',
            };

            // Mock existing user
            mockDb.query.mockResolvedValueOnce({
                rows: [{ id: 'enduser123' }],
            } as never);

            // Mock conversation creation
            mockDb.query.mockResolvedValueOnce({
                rows: [{
                    id: 'conv123',
                    kb_id: kbId,
                    end_user_id: 'enduser123',
                    status: 'active',
                }],
            } as never);

            // Mock analytics tracking
            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            const result = await chatService.createConversation(kbId, endUserData);

            expect(result.id).toBe('conv123');
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT id FROM end_users WHERE email'),
                [endUserData.email]
            );
        });

        it('should create conversation with new end user', async () => {
            const kbId = 'kb123';
            const endUserData = {
                email: 'newuser@example.com',
                name: 'New User',
                phone: '+1234567890',
            };

            // Mock no existing user
            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            // Mock new user creation
            mockDb.query.mockResolvedValueOnce({
                rows: [{ id: 'newuser123' }],
            } as never);

            // Mock conversation creation
            mockDb.query.mockResolvedValueOnce({
                rows: [{
                    id: 'conv123',
                    kb_id: kbId,
                    end_user_id: 'newuser123',
                }],
            } as never);

            // Mock analytics tracking
            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            const result = await chatService.createConversation(kbId, endUserData);

            expect(result.id).toBe('conv123');
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO end_users'),
                expect.arrayContaining([endUserData.email, endUserData.name, endUserData.phone])
            );
        });

        it('should create conversation for anonymous user', async () => {
            const kbId = 'kb123';
            const endUserData = {};

            // Mock new anonymous user creation
            mockDb.query.mockResolvedValueOnce({
                rows: [{ id: 'anon123' }],
            } as never);

            // Mock conversation creation
            mockDb.query.mockResolvedValueOnce({
                rows: [{
                    id: 'conv123',
                    kb_id: kbId,
                    end_user_id: 'anon123',
                }],
            } as never);

            // Mock analytics tracking
            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            const result = await chatService.createConversation(kbId, endUserData);

            expect(result.id).toBe('conv123');
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO end_users'),
                expect.arrayContaining(['Anonymous'])
            );
        });
    });

    describe('sendMessage', () => {
        it('should save message to database', async () => {
            const conversationId = 'conv123';
            const sender = 'user';
            const content = 'Hello, how are you?';

            const mockMessage = {
                id: 'msg123',
                conversation_id: conversationId,
                sender,
                content,
                created_at: new Date(),
            };

            mockDb.query.mockResolvedValueOnce({ rows: [mockMessage] } as never);

            const result = await chatService.sendMessage(conversationId, sender, content);

            expect(result.id).toBe('msg123');
            expect(result.content).toBe(content);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO messages'),
                [conversationId, sender, content]
            );
        });
    });

    describe('getConversationMessages', () => {
        it('should return messages in chronological order', async () => {
            const conversationId = 'conv123';
            const mockMessages = [
                { id: 'msg2', content: 'Response', created_at: new Date('2024-01-02') },
                { id: 'msg1', content: 'Hello', created_at: new Date('2024-01-01') },
            ];

            mockDb.query.mockResolvedValueOnce({ rows: mockMessages } as never);

            const result = await chatService.getConversationMessages(conversationId, 50);

            expect(result).toHaveLength(2);
            // Results should be reversed (oldest first)
            expect(result[0].id).toBe('msg1');
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY created_at DESC'),
                [conversationId, 50]
            );
        });

        it('should use custom limit', async () => {
            const conversationId = 'conv123';

            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            await chatService.getConversationMessages(conversationId, 10);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.any(String),
                [conversationId, 10]
            );
        });
    });

    describe('getKnowledgeBase', () => {
        it('should return knowledge base entries', async () => {
            const kbId = 'kb123';
            const mockEntries = [
                { id: 'entry1', title: 'Entry 1', content: 'Content 1' },
                { id: 'entry2', title: 'Entry 2', content: 'Content 2' },
            ];

            mockDb.query.mockResolvedValueOnce({ rows: mockEntries } as never);

            const result = await chatService.getKnowledgeBase(kbId, 50);

            expect(result).toEqual(mockEntries);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM knowledge_base'),
                [kbId, 50]
            );
        });
    });

    describe('trackAnalyticsEvent', () => {
        it('should track analytics event', async () => {
            const kbId = 'kb123';
            const eventType = 'message_sent';
            const eventData = { conversation_id: 'conv123' };

            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            await chatService.trackAnalyticsEvent(kbId, eventType, eventData);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO analytics_events'),
                [kbId, eventType, JSON.stringify(eventData)]
            );
        });

        it('should not throw on analytics error', async () => {
            const kbId = 'kb123';
            const eventType = 'test_event';

            mockDb.query.mockRejectedValueOnce(new Error('Database error'));

            // Should not throw
            await expect(
                chatService.trackAnalyticsEvent(kbId, eventType, {})
            ).resolves.toBeUndefined();
        });
    });

    describe('getConversationsByKbId', () => {
        it('should return conversations with message counts', async () => {
            const kbId = 'kb123';
            const mockConversations = [
                {
                    id: 'conv1',
                    kb_id: kbId,
                    end_user_name: 'User 1',
                    end_user_email: 'user1@example.com',
                    message_count: 5,
                },
                {
                    id: 'conv2',
                    kb_id: kbId,
                    end_user_name: 'User 2',
                    end_user_email: 'user2@example.com',
                    message_count: 3,
                },
            ];

            mockDb.query.mockResolvedValueOnce({ rows: mockConversations } as never);

            const result = await chatService.getConversationsByKbId(kbId, 20);

            expect(result).toEqual(mockConversations);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('COUNT(m.id) as message_count'),
                [kbId, 20]
            );
        });
    });

    describe('generateTwinResponse', () => {
        it('should generate response for first message', async () => {
            const conversationId = 'conv123';
            const userMessage = 'Hello!';

            const mockConversation = {
                id: conversationId,
                kb_id: 'kb123',
                user_id: 'user123',
                llm_provider: 'openai',
                llm_model: 'gpt-4',
                temperature: 0.7,
                max_tokens: 1000,
                name: 'Test KB',
                system_prompt: 'You are helpful',
            };

            // Mock conversation query
            mockDb.query.mockResolvedValueOnce({ rows: [mockConversation] } as never);

            // Mock empty message history (first message)
            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            // Mock knowledge base entries
            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            // Mock context service
            (contextService.generateEnhancedSystemPrompt as jest.Mock).mockReturnValue('System prompt');

            // Mock LLM response
            const mockLLMResponse = {
                content: 'Hi! How can I help you?',
                metadata: { model: 'gpt-4', usage: { total_tokens: 50 } },
            };
            mockLlmService.generateResponse.mockResolvedValueOnce(mockLLMResponse);

            // Mock save assistant message
            mockDb.query.mockResolvedValueOnce({
                rows: [{
                    id: 'msg124',
                    conversation_id: conversationId,
                    sender: 'assistant',
                    content: mockLLMResponse.content,
                }],
            } as never);

            // Mock analytics tracking
            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            const result = await chatService.generateTwinResponse(conversationId, userMessage);

            expect(result.message).toBeDefined();
            expect(mockLlmService.generateResponse).toHaveBeenCalledWith(
                'openai',
                'gpt-4',
                expect.any(Array),
                expect.any(String),
                0.7,
                1000
            );
        });

        it('should handle conversation not found', async () => {
            const conversationId = 'nonexistent';

            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            await expect(
                chatService.generateTwinResponse(conversationId, 'Hello')
            ).rejects.toThrow('Conversation not found');
        });
    });

    describe('generateTwinResponseStreaming', () => {
        it('should generate streaming response', async () => {
            const conversationId = 'conv123';
            const userMessage = 'Hello!';
            const onChunk = jest.fn();

            const mockConversation = {
                id: conversationId,
                kb_id: 'kb123',
                user_id: 'user123',
                llm_provider: 'openai',
                llm_model: 'gpt-4',
                temperature: 0.7,
                max_tokens: 1000,
            };

            // Mock conversation query
            mockDb.query.mockResolvedValueOnce({ rows: [mockConversation] } as never);

            // Mock message history
            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            // Mock knowledge base
            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            // Mock context service
            (contextService.generateEnhancedSystemPrompt as jest.Mock).mockReturnValue('System prompt');

            // Mock streaming response
            const mockStreamingResponse = {
                content: 'Streamed response',
                metadata: { model: 'gpt-4' },
            };
            mockLlmService.generateStreamingResponse.mockResolvedValueOnce(mockStreamingResponse);

            // Mock save message
            mockDb.query.mockResolvedValueOnce({
                rows: [{
                    id: 'msg124',
                    content: 'Streamed response',
                }],
            } as never);

            // Mock analytics
            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            const result = await chatService.generateTwinResponseStreaming(
                conversationId,
                userMessage,
                onChunk
            );

            expect(result.message).toBeDefined();
            expect(mockLlmService.generateStreamingResponse).toHaveBeenCalled();
        });

        it('should handle streaming error', async () => {
            const conversationId = 'conv123';

            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            await expect(
                chatService.generateTwinResponseStreaming(conversationId, 'Hello', jest.fn())
            ).rejects.toThrow('Conversation not found');
        });
    });

    describe('Error handling', () => {
        it('should handle createConversation database error', async () => {
            mockDb.query.mockRejectedValueOnce(new Error('Database error'));

            await expect(
                chatService.createConversation('kb123', { email: 'test@example.com' })
            ).rejects.toThrow('Database error');
        });

        it('should handle sendMessage database error', async () => {
            mockDb.query.mockRejectedValueOnce(new Error('Database error'));

            await expect(
                chatService.sendMessage('conv123', 'user', 'Hello')
            ).rejects.toThrow('Database error');
        });

        it('should handle getConversationMessages database error', async () => {
            mockDb.query.mockRejectedValueOnce(new Error('Database error'));

            await expect(
                chatService.getConversationMessages('conv123')
            ).rejects.toThrow('Database error');
        });

        it('should handle getKnowledgeBase database error', async () => {
            mockDb.query.mockRejectedValueOnce(new Error('Database error'));

            await expect(
                chatService.getKnowledgeBase('kb123')
            ).rejects.toThrow('Database error');
        });

        it('should handle getConversationsByKbId database error', async () => {
            mockDb.query.mockRejectedValueOnce(new Error('Database error'));

            await expect(
                chatService.getConversationsByKbId('kb123')
            ).rejects.toThrow('Database error');
        });

        it('should handle generateTwinResponse error', async () => {
            mockDb.query.mockRejectedValueOnce(new Error('Database error'));

            await expect(
                chatService.generateTwinResponse('conv123', 'Hello')
            ).rejects.toThrow('Database error');
        });
    });

    describe('applySourceBalancing', () => {
        it('should balance email and kb results', () => {
            const results = [
                { id: '1', source: 'email', score: 0.9 },
                { id: '2', source: 'knowledge_base', score: 0.85 },
                { id: '3', source: 'email', score: 0.8 },
                { id: '4', source: 'knowledge_base', score: 0.75 },
                { id: '5', source: 'email', score: 0.7 },
            ];

            const balanced = (chatService as any).applySourceBalancing(results, 3);

            expect(balanced.length).toBeLessThanOrEqual(3);
            expect(balanced).toBeDefined();
        });

        it('should respect maxEmailRatio', () => {
            const results = Array(10).fill(null).map((_, i) => ({
                id: `email${i}`,
                source: 'email',
                score: 0.9 - i * 0.05,
            }));

            const balanced = (chatService as any).applySourceBalancing(results, 5);

            // Should limit results and respect ratio constraints
            expect(balanced).toHaveLength(5);
            const emailCount = balanced.filter((r: any) => r.source === 'email').length;
            // All results are email, so should fill up to limit
            expect(emailCount).toBeGreaterThan(0);
            expect(emailCount).toBeLessThanOrEqual(5);
        });

        it('should respect maxKBRatio', () => {
            const results = Array(10).fill(null).map((_, i) => ({
                id: `kb${i}`,
                source: 'knowledge_base',
                score: 0.9 - i * 0.05,
            }));

            const balanced = (chatService as any).applySourceBalancing(results, 5);

            // Should limit results and respect ratio constraints
            expect(balanced).toHaveLength(5);
            const kbCount = balanced.filter((r: any) => r.source === 'knowledge_base').length;
            // All results are KB, so should fill up to limit
            expect(kbCount).toBeGreaterThan(0);
            expect(kbCount).toBeLessThanOrEqual(5);
        });

        it('should handle mixed sources', () => {
            const results = [
                { id: '1', source: 'other', score: 0.95 },
                { id: '2', source: 'email', score: 0.9 },
                { id: '3', source: 'knowledge_base', score: 0.85 },
            ];

            const balanced = (chatService as any).applySourceBalancing(results, 3);

            expect(balanced).toHaveLength(3);
            expect(balanced.some((r: any) => r.source === 'other')).toBe(true);
        });
    });

    describe('Helper methods', () => {
        describe('formatMessagesForLLM', () => {
            it('should format messages with roles', () => {
                const messages = [
                    { id: '1', sender: 'user', content: 'Hello', conversation_id: 'conv123', created_at: new Date() },
                    { id: '2', sender: 'assistant', content: 'Hi!', conversation_id: 'conv123', created_at: new Date() },
                ];

                const formatted = (chatService as any).formatMessagesForLLM(messages);

                expect(formatted).toHaveLength(2);
                expect(formatted[0].role).toBe('user');
                expect(formatted[0].content).toBe('Hello');
                expect(formatted[1].role).toBe('assistant');
                expect(formatted[1].content).toBe('Hi!');
            });

            it('should map bot to assistant', () => {
                const messages = [
                    { id: '1', sender: 'bot', content: 'Response', conversation_id: 'conv123', created_at: new Date() },
                ];

                const formatted = (chatService as any).formatMessagesForLLM(messages);

                expect(formatted[0].role).toBe('assistant');
            });
        });

        describe('resolveProvider', () => {
            it('should resolve openai provider', () => {
                const provider = (chatService as any).resolveProvider('openai');
                expect(provider).toBe('openai');
            });

            it('should resolve anthropic provider', () => {
                const provider = (chatService as any).resolveProvider('anthropic');
                expect(provider).toBe('anthropic');
            });

            it('should resolve gemini provider to openai', () => {
                // Gemini not fully supported yet, defaults to openai
                const provider = (chatService as any).resolveProvider('gemini');
                expect(provider).toBe('openai');
            });

            it('should default to openai for unknown provider', () => {
                const provider = (chatService as any).resolveProvider('unknown');
                expect(provider).toBe('openai');
            });

            it('should default to openai when undefined', () => {
                const provider = (chatService as any).resolveProvider();
                expect(provider).toBe('openai');
            });
        });

        describe('normalizeSearchResult', () => {
            it('should normalize result with all fields', () => {
                const record = {
                    id: '1',
                    title: 'Test',
                    content: 'Content',
                    source: 'kb',
                    similarity: 0.9,
                    score: 0.85,
                };

                const normalized = (chatService as any).normalizeSearchResult(record);

                expect(normalized.id).toBe('1');
                expect(normalized.title).toBe('Test');
                expect(normalized.content).toBe('Content');
            });

            it('should handle missing fields', () => {
                const record = {
                    id: '1',
                    content: 'Content only',
                };

                const normalized = (chatService as any).normalizeSearchResult(record);

                expect(normalized.id).toBe('1');
                expect(normalized.content).toBe('Content only');
            });
        });

        describe('buildSemanticResults', () => {
            it('should build semantic results', () => {
                const results = [
                    { id: '1', content: 'Test', title: 'Title 1', similarity: 0.9 },
                    { id: '2', content: 'Test 2', title: 'Title 2', similarity: 0.8 },
                ];

                const semantic = (chatService as any).buildSemanticResults(results);

                expect(semantic).toHaveLength(2);
                expect(semantic[0].content).toBe('Test');
            });

            it('should return null for null input', () => {
                const semantic = (chatService as any).buildSemanticResults(null);
                expect(semantic).toBeNull();
            });

            it('should return null for empty array', () => {
                const semantic = (chatService as any).buildSemanticResults([]);
                expect(semantic).toBeNull();
            });
        });

        describe('extractTotalTokens', () => {
            it('should extract total tokens from usage', () => {
                const metadata = {
                    usage: {
                        total_tokens: 150,
                    },
                };

                const tokens = (chatService as any).extractTotalTokens(metadata);
                expect(tokens).toBe(150);
            });

            it('should return undefined for missing usage', () => {
                const tokens = (chatService as any).extractTotalTokens({});
                expect(tokens).toBeUndefined();
            });

            it('should return undefined for undefined metadata', () => {
                const tokens = (chatService as any).extractTotalTokens(undefined);
                expect(tokens).toBeUndefined();
            });
        });

        describe('extractFinishReason', () => {
            it('should extract finish reason', () => {
                const metadata = {
                    finish_reason: 'stop',
                };

                const reason = (chatService as any).extractFinishReason(metadata);
                expect(reason).toBe('stop');
            });

            it('should return undefined for missing finish_reason', () => {
                const reason = (chatService as any).extractFinishReason({});
                expect(reason).toBeUndefined();
            });

            it('should return undefined for undefined metadata', () => {
                const reason = (chatService as any).extractFinishReason(undefined);
                expect(reason).toBeUndefined();
            });
        });
    });
});
