import knowledgeBaseService from './knowledgeBaseService';
import db from '../config/database';
import llmService from './llmService';
import fileProcessingService from './fileProcessingService';
import vectorStoreService from './vectorStoreService';

jest.mock('../config/database');
jest.mock('./llmService');
jest.mock('./fileProcessingService');
jest.mock('./vectorStoreService');
jest.mock('../config/logger');
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
        semanticSearch: {
            sourceThresholds: {
                knowledgeBase: 0.8,
                email: 0.75,
            },
            defaultMaxResults: 5,
            ensembleBalancing: {
                maxEmailRatio: 0.6,
                maxKBRatio: 0.7,
            },
        },
        ragOptimization: {
            hybridSearch: {
                enabled: true,
                vectorWeight: 0.7,
                bm25Weight: 0.3,
                fusionMethod: 'weighted',
            },
            reranking: {
                enabled: true,
                useDiversityFilter: true,
                diversityThreshold: 0.8,
                useMMR: true,
                mmrLambda: 0.5,
                semanticBoost: {
                    enabled: true,
                    maxBoost: 0.05,
                    minThreshold: 0.3,
                },
                finalK: 5,
            },
            assetEnrichment: {
                tables: {
                    maxColumns: 10,
                },
            },
        },
        fileUpload: {
            allowedMimeTypes: ['text/plain', 'application/pdf'],
            maxSizeBytes: 10000000,
        },
    },
}));

const mockDb = db as jest.Mocked<typeof db>;
const mockLlmService = llmService as jest.Mocked<typeof llmService>;

describe('KnowledgeBaseService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createKnowledgeBase', () => {
        it('should create knowledge base successfully', async () => {
            const userId = 'user123';
            const kbData = {
                name: 'Test KB',
                description: 'Test Description',
                llmProvider: 'openai',
                llmModel: 'gpt-4',
                systemPrompt: 'You are a helpful assistant',
            };

            const mockResult = {
                id: 'kb123',
                user_id: userId,
                ...kbData,
                created_at: new Date(),
            };

            mockDb.query.mockResolvedValueOnce({ rows: [mockResult] } as never);

            const result = await knowledgeBaseService.createKnowledgeBase(userId, kbData);

            expect(result.id).toBe('kb123');
            expect(result.name).toBe('Test KB');
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO knowledge_bases'),
                expect.arrayContaining([userId, 'Test KB', 'Test Description'])
            );
        });

        it('should use default values for optional fields', async () => {
            const userId = 'user123';
            const kbData = {
                name: 'Minimal KB',
            };

            const mockResult = {
                id: 'kb123',
                user_id: userId,
                name: 'Minimal KB',
                llm_provider: 'openai',
            };

            mockDb.query.mockResolvedValueOnce({ rows: [mockResult] } as never);

            const result = await knowledgeBaseService.createKnowledgeBase(userId, kbData);

            expect(result.name).toBe('Minimal KB');
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining([userId, 'Minimal KB'])
            );
        });
    });

    describe('updateKnowledgeBase', () => {
        it('should update knowledge base successfully', async () => {
            const kbId = 'kb123';
            const userId = 'user123';
            const updates = {
                name: 'Updated KB',
                description: 'Updated Description',
            };

            const mockResult = {
                id: kbId,
                user_id: userId,
                name: 'Updated KB',
                description: 'Updated Description',
            };

            mockDb.query.mockResolvedValueOnce({ rows: [mockResult] } as never);

            const result = await knowledgeBaseService.updateKnowledgeBase(kbId, userId, updates);

            expect(result.name).toBe('Updated KB');
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE knowledge_bases'),
                expect.arrayContaining(['Updated KB', 'Updated Description', kbId, userId])
            );
        });

        it('should throw error if no valid fields to update', async () => {
            const kbId = 'kb123';
            const userId = 'user123';
            const updates = {
                invalid_field: 'value',
            };

            await expect(
                knowledgeBaseService.updateKnowledgeBase(kbId, userId, updates as never)
            ).rejects.toThrow('No valid fields to update');
        });

        it('should throw error if knowledge base not found', async () => {
            const kbId = 'nonexistent';
            const userId = 'user123';
            const updates = { name: 'Updated' };

            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            await expect(
                knowledgeBaseService.updateKnowledgeBase(kbId, userId, updates)
            ).rejects.toThrow('Knowledge base not found or unauthorized');
        });
    });

    describe('getKnowledgeBaseByUserId', () => {
        it('should return knowledge base if found', async () => {
            const userId = 'user123';
            const mockKB = {
                id: 'kb123',
                user_id: userId,
                name: 'Test KB',
            };

            mockDb.query.mockResolvedValueOnce({ rows: [mockKB] } as never);

            const result = await knowledgeBaseService.getKnowledgeBaseByUserId(userId);

            expect(result).toEqual(mockKB);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM knowledge_bases WHERE user_id'),
                [userId]
            );
        });

        it('should return null if not found', async () => {
            const userId = 'user123';

            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            const result = await knowledgeBaseService.getKnowledgeBaseByUserId(userId);

            expect(result).toBeNull();
        });
    });

    describe('getKnowledgeBaseById', () => {
        it('should return knowledge base if found and active', async () => {
            const kbId = 'kb123';
            const mockKB = {
                id: kbId,
                name: 'Test KB',
                is_active: true,
            };

            mockDb.query.mockResolvedValueOnce({ rows: [mockKB] } as never);

            const result = await knowledgeBaseService.getKnowledgeBaseById(kbId);

            expect(result).toEqual(mockKB);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('is_active = true'),
                [kbId]
            );
        });

        it('should return null if not found', async () => {
            const kbId = 'nonexistent';

            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            const result = await knowledgeBaseService.getKnowledgeBaseById(kbId);

            expect(result).toBeNull();
        });
    });

    describe('addKnowledgeBaseEntry', () => {
        it('should add knowledge base entry with embedding', async () => {
            const kbId = 'kb123';
            const entry = {
                kb_id: kbId,
                title: 'Test Entry',
                content: 'Test content for embedding',
                content_type: 'text',
            };

            const mockEmbedding = Array(1536).fill(0.1);
            const mockResult = {
                id: 'entry123',
                ...entry,
                embedding: mockEmbedding,
            };

            mockLlmService.generateEmbedding.mockResolvedValueOnce(mockEmbedding);
            (fileProcessingService.validateEmbedding as jest.Mock).mockReturnValue(undefined);
            mockDb.query.mockResolvedValueOnce({ rows: [mockResult] } as never);
            (vectorStoreService.upsertEmbedding as jest.Mock).mockResolvedValueOnce(undefined);

            const result = await knowledgeBaseService.addKnowledgeBaseEntry(kbId, entry);

            expect(result.id).toBe('entry123');
            expect(mockLlmService.generateEmbedding).toHaveBeenCalledWith('Test content for embedding', 'openai');
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO knowledge_base'),
                expect.arrayContaining([kbId, 'Test Entry', 'Test content for embedding', 'text'])
            );
        });

        it('should throw error if content is too large', async () => {
            const kbId = 'kb123';
            const largeContent = 'x'.repeat(50001);
            const entry = {
                kb_id: kbId,
                title: 'Large Entry',
                content: largeContent,
                content_type: 'text',
            };

            await expect(
                knowledgeBaseService.addKnowledgeBaseEntry(kbId, entry)
            ).rejects.toThrow('Content too large');
        });

        it('should use specified provider for embedding', async () => {
            const kbId = 'kb123';
            const entry = {
                kb_id: kbId,
                title: 'Test Entry',
                content: 'Test content',
                content_type: 'text',
                provider: 'openai' as const,
            };

            const mockEmbedding = Array(1536).fill(0.1);
            mockLlmService.generateEmbedding.mockResolvedValueOnce(mockEmbedding);
            (fileProcessingService.validateEmbedding as jest.Mock).mockReturnValue(undefined);
            mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'entry123', ...entry }] } as never);
            (vectorStoreService.upsertEmbedding as jest.Mock).mockResolvedValueOnce(undefined);

            await knowledgeBaseService.addKnowledgeBaseEntry(kbId, entry);

            expect(mockLlmService.generateEmbedding).toHaveBeenCalledWith('Test content', 'openai');
        });
    });

    describe('getKnowledgeBase', () => {
        it('should return knowledge base entries ordered by date', async () => {
            const kbId = 'kb123';
            const mockEntries = [
                { id: 'entry1', title: 'Entry 1', created_at: new Date('2024-01-02') },
                { id: 'entry2', title: 'Entry 2', created_at: new Date('2024-01-01') },
            ];

            mockDb.query.mockResolvedValueOnce({ rows: mockEntries } as never);

            const result = await knowledgeBaseService.getKnowledgeBase(kbId);

            expect(result).toEqual(mockEntries);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY created_at DESC'),
                [kbId]
            );
        });
    });

    describe('deleteKnowledgeBaseEntry', () => {
        it('should delete knowledge base entry successfully', async () => {
            const entryId = 'entry123';
            const kbId = 'kb123';

            mockDb.query.mockResolvedValueOnce({ rows: [{ id: entryId }] } as never);

            const result = await knowledgeBaseService.deleteKnowledgeBaseEntry(entryId, kbId);

            expect(result.success).toBe(true);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM knowledge_base'),
                [entryId, kbId]
            );
        });

        it('should throw error if entry not found', async () => {
            const entryId = 'nonexistent';
            const kbId = 'kb123';

            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            await expect(
                knowledgeBaseService.deleteKnowledgeBaseEntry(entryId, kbId)
            ).rejects.toThrow('Knowledge base entry not found');
        });
    });

    describe('getRAGConfig', () => {
        it('should return RAG config merged with defaults', async () => {
            const kbId = 'kb123';
            const storedConfig = {
                knowledgeBaseThreshold: 0.85,
                emailThreshold: 0.8,
            };

            mockDb.query.mockResolvedValueOnce({
                rows: [{ rag_config: storedConfig }],
            } as never);

            const result = await knowledgeBaseService.getRAGConfig(kbId);

            expect(result).toBeDefined();
            expect(result?.knowledgeBaseThreshold).toBe(0.85);
            expect(result?.emailThreshold).toBe(0.8);
            expect(result?.maxResults).toBe(5);
        });

        it('should return null if knowledge base not found', async () => {
            const kbId = 'nonexistent';

            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            const result = await knowledgeBaseService.getRAGConfig(kbId);

            expect(result).toBeNull();
        });

        it('should return defaults if no stored config', async () => {
            const kbId = 'kb123';

            mockDb.query.mockResolvedValueOnce({
                rows: [{ rag_config: null }],
            } as never);

            const result = await knowledgeBaseService.getRAGConfig(kbId);

            expect(result).toBeDefined();
            expect(result?.knowledgeBaseThreshold).toBe(0.8);
            expect(result?.emailThreshold).toBe(0.75);
        });
    });

    describe('updateRAGConfig', () => {
        it('should update RAG config successfully', async () => {
            const kbId = 'kb123';
            const newConfig = {
                knowledgeBaseThreshold: 0.9,
                emailThreshold: 0.85,
                maxResults: 10,
            };

            mockDb.query.mockResolvedValueOnce({
                rows: [{ rag_config: newConfig }],
            } as never);

            const result = await knowledgeBaseService.updateRAGConfig(kbId, newConfig);

            expect(result).toEqual(newConfig);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE knowledge_bases'),
                [JSON.stringify(newConfig), kbId]
            );
        });

        it('should throw error if knowledge base not found', async () => {
            const kbId = 'nonexistent';
            const config = { knowledgeBaseThreshold: 0.9 };

            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            await expect(
                knowledgeBaseService.updateRAGConfig(kbId, config)
            ).rejects.toThrow('Knowledge base not found');
        });
    });
});
