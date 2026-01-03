import type { Response, NextFunction } from 'express';
import chatController from './chatController';
import chatService from '../services/chatService';
import knowledgeBaseService from '../services/knowledgeBaseService';
import chatIntegrationService from '../services/chatIntegrationService';
import { AuthenticatedRequest } from '../middleware/auth';

jest.mock('../services/chatService');
jest.mock('../services/knowledgeBaseService');
jest.mock('../services/chatIntegrationService');

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

describe('ChatController', () => {
    const next: NextFunction = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (chatIntegrationService.isEnabled as jest.Mock).mockReturnValue(false);
    });

    describe('startConversation', () => {
        it('should start conversation successfully', async () => {
            const mockKB = {
                id: 'kb123',
                user_id: 'user123',
                name: 'Test KB',
                is_active: true,
            };
            const mockConversation = {
                id: 'conv123',
                kb_id: 'kb123',
                status: 'active',
            };
            const endUserData = {
                email: 'enduser@example.com',
                name: 'End User',
            };

            (knowledgeBaseService.getKnowledgeBaseById as jest.Mock).mockResolvedValue(mockKB);
            (chatService.createConversation as jest.Mock).mockResolvedValue(mockConversation);

            const req = createMockRequest({
                params: { kbId: 'kb123' },
                body: endUserData,
            });
            const res = createMockResponse();

            await chatController.startConversation(req, res, next);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Conversation started',
                conversation: mockConversation,
            });
        });

        it('should return 404 if knowledge base not found', async () => {
            (knowledgeBaseService.getKnowledgeBaseById as jest.Mock).mockResolvedValue(null);

            const req = createMockRequest({
                params: { kbId: 'nonexistent' },
                body: { email: 'user@example.com' },
            });
            const res = createMockResponse();

            await chatController.startConversation(req, res, next);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'Knowledge base not found' });
        });

        it('should use integration service if enabled', async () => {
            (chatIntegrationService.isEnabled as jest.Mock).mockReturnValue(true);
            const mockResult = {
                conversation: { id: 'conv123' },
            };

            (chatIntegrationService.startConversation as jest.Mock).mockResolvedValue(mockResult);

            const req = createMockRequest({
                params: { kbId: 'kb123' },
                body: { email: 'user@example.com' },
            });
            const res = createMockResponse();

            await chatController.startConversation(req, res, next);

            expect(chatIntegrationService.startConversation).toHaveBeenCalledWith(
                'kb123',
                { email: 'user@example.com' }
            );
            expect(res.status).toHaveBeenCalledWith(201);
        });
    });

    describe('sendMessage', () => {
        it('should send message and generate response', async () => {
            const mockUserMessage = {
                id: 'msg123',
                conversation_id: 'conv123',
                sender: 'user',
                content: 'Hello',
            };
            const mockKBResponse = {
                message: {
                    id: 'msg124',
                    conversation_id: 'conv123',
                    sender: 'assistant',
                    content: 'Hi there!',
                },
            };

            (chatService.sendMessage as jest.Mock).mockResolvedValue(mockUserMessage);
            (chatService.generateKnowledgeBaseResponse as jest.Mock).mockResolvedValue(mockKBResponse);

            const req = createMockRequest({
                params: { conversationId: 'conv123' },
                body: { content: 'Hello' },
            });
            const res = createMockResponse();

            await chatController.sendMessage(req, res, next);

            expect(chatService.sendMessage).toHaveBeenCalledWith('conv123', 'user', 'Hello');
            expect(chatService.generateKnowledgeBaseResponse).toHaveBeenCalledWith('conv123', 'Hello');
            expect(res.json).toHaveBeenCalledWith({
                userMessage: mockUserMessage,
                assistantResponse: mockKBResponse.message,
            });
        });

        it('should use integration service if enabled', async () => {
            (chatIntegrationService.isEnabled as jest.Mock).mockReturnValue(true);
            const mockResult = {
                userMessage: { id: 'msg123' },
                assistantResponse: { id: 'msg124' },
            };

            (chatIntegrationService.sendMessage as jest.Mock).mockResolvedValue(mockResult);

            const req = createMockRequest({
                params: { conversationId: 'conv123' },
                body: { content: 'Hello' },
            });
            const res = createMockResponse();

            await chatController.sendMessage(req, res, next);

            expect(chatIntegrationService.sendMessage).toHaveBeenCalledWith('conv123', { content: 'Hello' });
            expect(res.json).toHaveBeenCalledWith(mockResult);
        });
    });

    describe('getMessages', () => {
        it('should return conversation messages', async () => {
            const mockMessages = [
                { id: 'msg1', content: 'Hello', sender: 'user' },
                { id: 'msg2', content: 'Hi!', sender: 'assistant' },
            ];

            (chatService.getConversationMessages as jest.Mock).mockResolvedValue(mockMessages);

            const req = createMockRequest({
                params: { conversationId: 'conv123' },
                query: {},
            });
            const res = createMockResponse();

            await chatController.getMessages(req, res, next);

            expect(chatService.getConversationMessages).toHaveBeenCalledWith('conv123', 50);
            expect(res.json).toHaveBeenCalledWith({ messages: mockMessages });
        });

        it('should use custom limit if provided', async () => {
            const mockMessages = [{ id: 'msg1', content: 'Hello' }];

            (chatService.getConversationMessages as jest.Mock).mockResolvedValue(mockMessages);

            const req = createMockRequest({
                params: { conversationId: 'conv123' },
                query: { limit: '10' },
            });
            const res = createMockResponse();

            await chatController.getMessages(req, res, next);

            expect(chatService.getConversationMessages).toHaveBeenCalledWith('conv123', 10);
        });

        it('should use integration service if enabled', async () => {
            (chatIntegrationService.isEnabled as jest.Mock).mockReturnValue(true);
            const mockResult = {
                messages: [{ id: 'msg1' }],
            };

            (chatIntegrationService.getMessages as jest.Mock).mockResolvedValue(mockResult);

            const req = createMockRequest({
                params: { conversationId: 'conv123' },
                query: { limit: '20' },
            });
            const res = createMockResponse();

            await chatController.getMessages(req, res, next);

            expect(chatIntegrationService.getMessages).toHaveBeenCalledWith('conv123', 20);
            expect(res.json).toHaveBeenCalledWith(mockResult);
        });
    });

    describe('getMyConversations', () => {
        it('should return user conversations', async () => {
            const mockKB = { id: 'kb123', user_id: 'user123' };
            const mockConversations = [
                { id: 'conv1', kb_id: 'kb123', status: 'active' },
                { id: 'conv2', kb_id: 'kb123', status: 'closed' },
            ];

            (knowledgeBaseService.getKnowledgeBaseByUserId as jest.Mock).mockResolvedValue(mockKB);
            (chatService.getConversationsByKbId as jest.Mock).mockResolvedValue(mockConversations);

            const req = createMockRequest();
            const res = createMockResponse();

            await chatController.getMyConversations(req, res, next);

            expect(knowledgeBaseService.getKnowledgeBaseByUserId).toHaveBeenCalledWith('user123');
            expect(chatService.getConversationsByKbId).toHaveBeenCalledWith('kb123');
            expect(res.json).toHaveBeenCalledWith({ conversations: mockConversations });
        });

        it('should return 404 if knowledge base not found', async () => {
            (knowledgeBaseService.getKnowledgeBaseByUserId as jest.Mock).mockResolvedValue(null);

            const req = createMockRequest();
            const res = createMockResponse();

            await chatController.getMyConversations(req, res, next);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'Knowledge base not found' });
        });

        it('should use integration service if enabled', async () => {
            (chatIntegrationService.isEnabled as jest.Mock).mockReturnValue(true);
            const mockResult = {
                conversations: [{ id: 'conv1' }],
            };

            (chatIntegrationService.getMyConversations as jest.Mock).mockResolvedValue(mockResult);

            const req = createMockRequest();
            const res = createMockResponse();

            await chatController.getMyConversations(req, res, next);

            expect(chatIntegrationService.getMyConversations).toHaveBeenCalledWith('user123');
            expect(res.json).toHaveBeenCalledWith(mockResult);
        });
    });
});
