import type { Request, Response, NextFunction } from 'express';
import authController from './authController';
import authService from '../services/authService';

jest.mock('../services/authService');

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

describe('Auth Controller', () => {
    const next: NextFunction = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('register', () => {
        it('responds with 201 when registration succeeds', async () => {
            const mockUser = {
                id: '1',
                email: 'test@example.com',
                full_name: 'Test User',
                role: 'professional',
            };

            (authService.register as jest.Mock).mockResolvedValue({
                user: mockUser,
                token: 'mock_token',
            });

            const req = {
                body: {
                    email: 'test@example.com',
                    password: 'password123',
                    fullName: 'Test User',
                    role: 'professional',
                },
            } as Request;
            const res = createMockResponse();

            await authController.register(req, res, next);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                message: 'User registered successfully',
                user: mockUser,
                token: 'mock_token',
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('returns 409 when user already exists', async () => {
            (authService.register as jest.Mock).mockRejectedValue(new Error('User already exists with this email'));

            const req = {
                body: { email: 'test@example.com', password: 'password123', fullName: 'Test User' },
            } as Request;
            const res = createMockResponse();

            await authController.register(req, res, next);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({ error: 'User already exists with this email' });
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('login', () => {
        it('returns token when login succeeds', async () => {
            const mockUser = {
                id: '1',
                email: 'test@example.com',
                full_name: 'Test User',
                role: 'professional',
            };

            (authService.login as jest.Mock).mockResolvedValue({
                user: mockUser,
                token: 'mock_token',
            });

            const req = {
                body: { email: 'test@example.com', password: 'password123' },
            } as Request;
            const res = createMockResponse();

            await authController.login(req, res, next);

            expect(res.json).toHaveBeenCalledWith({
                message: 'Login successful',
                user: mockUser,
                token: 'mock_token',
            });
        });

        it('returns 401 for invalid credentials', async () => {
            (authService.login as jest.Mock).mockRejectedValue(new Error('Invalid credentials'));
            const req = {
                body: { email: 'test@example.com', password: 'wrong' },
            } as Request;
            const res = createMockResponse();

            await authController.login(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
        });
    });

    describe('getMe', () => {
        it('returns the current user', async () => {
            const mockUser = { id: '1', email: 'test@example.com' };
            (authService.getUserById as jest.Mock).mockResolvedValue(mockUser);

            const req = {
                user: { userId: '1' },
            } as unknown as Request;
            const res = createMockResponse();

            await authController.getMe(req, res, next);

            expect(res.json).toHaveBeenCalledWith({ user: mockUser });
        });
    });
});
