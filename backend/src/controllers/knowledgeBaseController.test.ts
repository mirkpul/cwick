import type { Response, NextFunction } from 'express';
import knowledgeBaseController from './knowledgeBaseController';
import knowledgeBaseService from '../services/knowledgeBaseService';
import contextService from '../services/contextService';
import fileProcessingService from '../services/fileProcessingService';
import documentProcessingService from '../services/documentProcessingService';
import { AuthenticatedRequest } from '../middleware/auth';

jest.mock('../services/knowledgeBaseService');
jest.mock('../services/contextService');
jest.mock('../services/fileProcessingService');
jest.mock('../services/documentProcessingService');
jest.mock('../config/database');
jest.mock('../services/llmService');

type MockResponse = Response & {
    status: jest.Mock;
    json: jest.Mock;
};

const createMockResponse = (): MockResponse => {
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    } as Partial<MockResponse>;
    return res as MockResponse;
};

const createMockRequest = (overrides?: Partial<AuthenticatedRequest>): AuthenticatedRequest => {
    return {
        user: { userId: 'user123', email: 'test@example.com', role: 'professional' },
        params: {},
        body: {},
        query: {},
        ...overrides,
    } as AuthenticatedRequest;
};

describe('KnowledgeBaseController', () => {
    const next: NextFunction = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create knowledge base successfully', async () => {
            const mockKB = {
                id: 'kb123',
                user_id: 'user123',
                name: 'Test KB',
                description: 'Test Description',
            };

            (knowledgeBaseService.getKnowledgeBaseByUserId as jest.Mock).mockResolvedValue(null);
            (knowledgeBaseService.createKnowledgeBase as jest.Mock).mockResolvedValue(mockKB);

            const req = createMockRequest({
                body: {
                    name: 'Test KB',
                    description: 'Test Description',
                },
            });
            const res = createMockResponse();

            await knowledgeBaseController.create(req, res, next);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Knowledge base created successfully',
                knowledgeBase: mockKB,
            });
        });

        it('should return 409 if knowledge base already exists', async () => {
            const existingKB = { id: 'kb123', name: 'Existing KB' };

            (knowledgeBaseService.getKnowledgeBaseByUserId as jest.Mock).mockResolvedValue(existingKB);

            const req = createMockRequest({
                body: { name: 'Test KB' },
            });
            const res = createMockResponse();

            await knowledgeBaseController.create(req, res, next);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Knowledge base already exists for this user',
                knowledgeBase: existingKB,
            });
        });
    });

    describe('getMyKB', () => {
        it('should return knowledge base if found', async () => {
            const mockKB = {
                id: 'kb123',
                user_id: 'user123',
                name: 'Test KB',
            };

            (knowledgeBaseService.getKnowledgeBaseByUserId as jest.Mock).mockResolvedValue(mockKB);

            const req = createMockRequest();
            const res = createMockResponse();

            await knowledgeBaseController.getMyKB(req, res, next);

            expect(res.json).toHaveBeenCalledWith({ knowledgeBase: mockKB });
        });

        it('should return 404 if knowledge base not found', async () => {
            (knowledgeBaseService.getKnowledgeBaseByUserId as jest.Mock).mockResolvedValue(null);

            const req = createMockRequest();
            const res = createMockResponse();

            await knowledgeBaseController.getMyKB(req, res, next);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'Knowledge base not found' });
        });
    });

    describe('update', () => {
        it('should update knowledge base successfully', async () => {
            const mockKB = {
                id: 'kb123',
                user_id: 'user123',
                name: 'Updated KB',
            };

            (knowledgeBaseService.updateKnowledgeBase as jest.Mock).mockResolvedValue(mockKB);

            const req = createMockRequest({
                params: { kbId: 'kb123' },
                body: { name: 'Updated KB' },
            });
            const res = createMockResponse();

            await knowledgeBaseController.update(req, res, next);

            expect(res.json).toHaveBeenCalledWith({
                message: 'Knowledge base updated successfully',
                knowledgeBase: mockKB,
            });
        });

        it('should return 404 if knowledge base not found', async () => {
            (knowledgeBaseService.updateKnowledgeBase as jest.Mock).mockRejectedValue(
                new Error('Knowledge base not found')
            );

            const req = createMockRequest({
                params: { kbId: 'nonexistent' },
                body: { name: 'Updated KB' },
            });
            const res = createMockResponse();

            await knowledgeBaseController.update(req, res, next);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'Knowledge base not found' });
        });
    });

    describe('addKnowledge', () => {
        it('should add knowledge entry successfully', async () => {
            const mockKB = { id: 'kb123', user_id: 'user123' };
            const mockEntry = {
                id: 'entry123',
                kb_id: 'kb123',
                title: 'Test Entry',
                content: 'Test Content',
            };

            (knowledgeBaseService.getKnowledgeBaseByUserId as jest.Mock).mockResolvedValue(mockKB);
            (knowledgeBaseService.addKnowledgeBaseEntry as jest.Mock).mockResolvedValue(mockEntry);

            const req = createMockRequest({
                params: { kbId: 'kb123' },
                body: {
                    title: 'Test Entry',
                    content: 'Test Content',
                    content_type: 'text',
                },
            });
            const res = createMockResponse();

            await knowledgeBaseController.addKnowledge(req, res, next);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Knowledge base entry added',
                knowledge: mockEntry,
            });
        });

        it('should return 403 if unauthorized', async () => {
            const mockKB = { id: 'different_kb', user_id: 'user123' };

            (knowledgeBaseService.getKnowledgeBaseByUserId as jest.Mock).mockResolvedValue(mockKB);

            const req = createMockRequest({
                params: { kbId: 'kb123' },
                body: { title: 'Test', content: 'Test' },
            });
            const res = createMockResponse();

            await knowledgeBaseController.addKnowledge(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
        });
    });

    describe('getKnowledge', () => {
        it('should return knowledge entries', async () => {
            const mockKB = { id: 'kb123', user_id: 'user123' };
            const mockEntries = [
                { id: 'entry1', title: 'Entry 1', content: 'Content 1' },
                { id: 'entry2', title: 'Entry 2', content: 'Content 2' },
            ];

            (knowledgeBaseService.getKnowledgeBaseByUserId as jest.Mock).mockResolvedValue(mockKB);
            (knowledgeBaseService.getKnowledgeBase as jest.Mock).mockResolvedValue(mockEntries);

            const req = createMockRequest({
                params: { kbId: 'kb123' },
            });
            const res = createMockResponse();

            await knowledgeBaseController.getKnowledge(req, res, next);

            expect(res.json).toHaveBeenCalledWith({ knowledge: mockEntries });
        });

        it('should return 403 if unauthorized', async () => {
            const mockKB = { id: 'different_kb', user_id: 'user123' };

            (knowledgeBaseService.getKnowledgeBaseByUserId as jest.Mock).mockResolvedValue(mockKB);

            const req = createMockRequest({
                params: { kbId: 'kb123' },
            });
            const res = createMockResponse();

            await knowledgeBaseController.getKnowledge(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
        });
    });

    describe('deleteKnowledge', () => {
        it('should delete knowledge entry successfully', async () => {
            const mockKB = { id: 'kb123', user_id: 'user123' };

            (knowledgeBaseService.getKnowledgeBaseByUserId as jest.Mock).mockResolvedValue(mockKB);
            (knowledgeBaseService.deleteKnowledgeBaseEntry as jest.Mock).mockResolvedValue({ success: true });

            const req = createMockRequest({
                params: { kbId: 'kb123', entryId: 'entry123' },
            });
            const res = createMockResponse();

            await knowledgeBaseController.deleteKnowledge(req, res, next);

            expect(res.json).toHaveBeenCalledWith({ message: 'Knowledge base entry deleted' });
        });
    });

    describe('previewContext', () => {
        it('should generate context preview', async () => {
            const mockKB = { id: 'kb123', user_id: 'user123', name: 'Test KB' };
            const mockFullKB = { id: 'kb123', name: 'Test KB' };
            const mockEntries = [{ id: 'entry1', title: 'Entry 1' }];
            const mockPreview = 'Context preview text';

            (knowledgeBaseService.getKnowledgeBaseByUserId as jest.Mock).mockResolvedValue(mockKB);
            (knowledgeBaseService.getKnowledgeBaseById as jest.Mock).mockResolvedValue(mockFullKB);
            (knowledgeBaseService.getKnowledgeBase as jest.Mock).mockResolvedValue(mockEntries);
            (contextService.generateContextPreview as jest.Mock).mockReturnValue(mockPreview);

            const req = createMockRequest({
                params: { kbId: 'kb123' },
            });
            const res = createMockResponse();

            await knowledgeBaseController.previewContext(req, res, next);

            expect(res.json).toHaveBeenCalledWith({
                contextPreview: mockPreview,
                knowledgeBase: {
                    id: 'kb123',
                    name: 'Test KB',
                },
            });
        });

        it('should return 404 if knowledge base not found', async () => {
            const mockKB = { id: 'kb123', user_id: 'user123' };

            (knowledgeBaseService.getKnowledgeBaseByUserId as jest.Mock).mockResolvedValue(mockKB);
            (knowledgeBaseService.getKnowledgeBaseById as jest.Mock).mockResolvedValue(null);

            const req = createMockRequest({
                params: { kbId: 'kb123' },
            });
            const res = createMockResponse();

            await knowledgeBaseController.previewContext(req, res, next);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'Knowledge base not found' });
        });
    });

    describe('updateContext', () => {
        it('should update custom instructions', async () => {
            const mockKB = { id: 'kb123', user_id: 'user123' };
            const mockUpdatedKB = { id: 'kb123', system_prompt: 'Updated instructions' };

            (knowledgeBaseService.getKnowledgeBaseByUserId as jest.Mock).mockResolvedValue(mockKB);
            (knowledgeBaseService.updateKnowledgeBase as jest.Mock).mockResolvedValue(mockUpdatedKB);

            const req = createMockRequest({
                params: { kbId: 'kb123' },
                body: { customInstructions: 'Updated instructions' },
            });
            const res = createMockResponse();

            await knowledgeBaseController.updateContext(req, res, next);

            expect(res.json).toHaveBeenCalledWith({
                message: 'Custom instructions updated successfully',
                knowledgeBase: mockUpdatedKB,
            });
        });
    });

    describe('uploadKnowledgeFile', () => {
        it('should upload and process file successfully', async () => {
            const mockKB = { id: 'kb123', user_id: 'user123' };
            const mockFile = {
                originalname: 'test.pdf',
                mimetype: 'application/pdf',
                size: 1000,
                buffer: Buffer.from('test'),
            } as Express.Multer.File;
            const mockResult = {
                message: 'File processed successfully',
                entriesCreated: 5,
            };

            (knowledgeBaseService.getKnowledgeBaseByUserId as jest.Mock).mockResolvedValue(mockKB);
            (fileProcessingService.validateFile as jest.Mock).mockReturnValue({ valid: true, errors: [] });
            (documentProcessingService.isEnabled as jest.Mock).mockReturnValue(false);
            (fileProcessingService.processFileForKnowledgeBase as jest.Mock).mockResolvedValue(mockResult);

            const req = createMockRequest({
                params: { kbId: 'kb123' },
                file: mockFile,
                body: {},
            });
            const res = createMockResponse();

            await knowledgeBaseController.uploadKnowledgeFile(req, res, next);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(mockResult);
        });

        it('should return 400 if no file provided', async () => {
            const mockKB = { id: 'kb123', user_id: 'user123' };

            (knowledgeBaseService.getKnowledgeBaseByUserId as jest.Mock).mockResolvedValue(mockKB);

            const req = createMockRequest({
                params: { kbId: 'kb123' },
                file: undefined,
            });
            const res = createMockResponse();

            await knowledgeBaseController.uploadKnowledgeFile(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'No file provided' });
        });

        it('should return 400 if file validation fails', async () => {
            const mockKB = { id: 'kb123', user_id: 'user123' };
            const mockFile = {
                originalname: 'test.exe',
                mimetype: 'application/exe',
                size: 1000,
            } as Express.Multer.File;

            (knowledgeBaseService.getKnowledgeBaseByUserId as jest.Mock).mockResolvedValue(mockKB);
            (fileProcessingService.validateFile as jest.Mock).mockReturnValue({
                valid: false,
                errors: ['Unsupported file type'],
            });

            const req = createMockRequest({
                params: { kbId: 'kb123' },
                file: mockFile,
            });
            const res = createMockResponse();

            await knowledgeBaseController.uploadKnowledgeFile(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Unsupported file type' });
        });
    });

    describe('getRAGConfig', () => {
        it('should return RAG configuration', async () => {
            const mockKB = { id: 'kb123', user_id: 'user123' };
            const mockConfig = {
                knowledgeBaseThreshold: 0.8,
                emailThreshold: 0.75,
            };

            (knowledgeBaseService.getKnowledgeBaseByUserId as jest.Mock).mockResolvedValue(mockKB);
            (knowledgeBaseService.getRAGConfig as jest.Mock).mockResolvedValue(mockConfig);

            const req = createMockRequest({
                params: { kbId: 'kb123' },
            });
            const res = createMockResponse();

            await knowledgeBaseController.getRAGConfig(req, res, next);

            expect(res.json).toHaveBeenCalledWith({ config: mockConfig });
        });
    });

    describe('updateRAGConfig', () => {
        it('should update RAG configuration successfully', async () => {
            const mockKB = { id: 'kb123', user_id: 'user123' };
            const mockConfig = {
                knowledgeBaseThreshold: 0.85,
                emailThreshold: 0.8,
            };

            (knowledgeBaseService.getKnowledgeBaseByUserId as jest.Mock).mockResolvedValue(mockKB);
            (knowledgeBaseService.updateRAGConfig as jest.Mock).mockResolvedValue(mockConfig);

            const req = createMockRequest({
                params: { kbId: 'kb123' },
                body: mockConfig,
            });
            const res = createMockResponse();

            await knowledgeBaseController.updateRAGConfig(req, res, next);

            expect(res.json).toHaveBeenCalledWith({
                message: 'RAG configuration updated successfully',
                config: mockConfig,
            });
        });

        it('should return 400 if config validation fails', async () => {
            const mockKB = { id: 'kb123', user_id: 'user123' };
            const invalidConfig = {
                knowledgeBaseThreshold: 1.5, // Invalid: > 1
            };

            (knowledgeBaseService.getKnowledgeBaseByUserId as jest.Mock).mockResolvedValue(mockKB);

            const req = createMockRequest({
                params: { kbId: 'kb123' },
                body: invalidConfig,
            });
            const res = createMockResponse();

            await knowledgeBaseController.updateRAGConfig(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ error: 'Invalid configuration' })
            );
        });
    });
});
