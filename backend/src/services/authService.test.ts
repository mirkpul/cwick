import authService from './authService';
import db from '../config/database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

jest.mock('../config/database');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
jest.mock('../config/logger');

const mockDb = db as jest.Mocked<typeof db>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('AuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
    });

    describe('register', () => {
        it('should register a new user successfully', async () => {
            const email = 'test@example.com';
            const password = 'password123';
            const fullName = 'Test User';
            const role = 'professional';

            // Mock user doesn't exist
            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            // Mock bcrypt hash
            mockBcrypt.hash.mockResolvedValue('hashed_password' as never);

            // Mock user creation
            mockDb.query.mockResolvedValueOnce({
                rows: [{
                    id: '123',
                    email,
                    full_name: fullName,
                    role,
                    created_at: new Date()
                }]
            } as never);

            // Mock subscription creation
            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            // Mock JWT sign
            mockJwt.sign.mockReturnValue('mock_token' as never);

            const result = await authService.register(email, password, fullName, role);

            expect(result.user.email).toBe(email);
            expect(result.user.full_name).toBe(fullName);
            expect(result.token).toBe('mock_token');
            expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 10);
            expect(mockJwt.sign).toHaveBeenCalledWith(
                { userId: '123', email, role },
                'test-secret',
                { expiresIn: '7d' }
            );
        });

        it('should throw error if user already exists', async () => {
            const email = 'existing@example.com';
            const password = 'password123';
            const fullName = 'Test User';

            // Mock user exists
            mockDb.query.mockResolvedValueOnce({
                rows: [{ id: '123' }]
            } as never);

            await expect(authService.register(email, password, fullName)).rejects.toThrow(
                'User already exists with this email'
            );
        });

        it('should create subscription for professional role', async () => {
            const email = 'pro@example.com';
            const password = 'password123';
            const fullName = 'Pro User';
            const role = 'professional';

            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);
            mockBcrypt.hash.mockResolvedValue('hashed_password' as never);
            mockDb.query.mockResolvedValueOnce({
                rows: [{
                    id: '456',
                    email,
                    full_name: fullName,
                    role,
                    created_at: new Date()
                }]
            } as never);
            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);
            mockJwt.sign.mockReturnValue('mock_token' as never);

            await authService.register(email, password, fullName, role);

            // Should have called db.query 3 times (check user, create user, create subscription)
            expect(mockDb.query).toHaveBeenCalledTimes(3);
            const subscriptionCall = mockDb.query.mock.calls[2];
            expect(subscriptionCall[0]).toContain('INSERT INTO subscriptions');
            expect(subscriptionCall[1]).toContain('456');
        });

        it('should not create subscription for super_admin role', async () => {
            const email = 'admin@example.com';
            const password = 'password123';
            const fullName = 'Admin User';
            const role = 'super_admin';

            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);
            mockBcrypt.hash.mockResolvedValue('hashed_password' as never);
            mockDb.query.mockResolvedValueOnce({
                rows: [{
                    id: '789',
                    email,
                    full_name: fullName,
                    role,
                    created_at: new Date()
                }]
            } as never);
            mockJwt.sign.mockReturnValue('mock_token' as never);

            await authService.register(email, password, fullName, role);

            // Should have called db.query 2 times only (check user, create user)
            expect(mockDb.query).toHaveBeenCalledTimes(2);
        });
    });

    describe('login', () => {
        it('should login successfully with valid credentials', async () => {
            const email = 'test@example.com';
            const password = 'password123';

            mockDb.query.mockResolvedValueOnce({
                rows: [{
                    id: '123',
                    email,
                    password_hash: 'hashed_password',
                    full_name: 'Test User',
                    role: 'professional',
                    is_active: true
                }]
            } as never);

            mockBcrypt.compare.mockResolvedValue(true as never);
            mockJwt.sign.mockReturnValue('mock_token' as never);

            const result = await authService.login(email, password);

            expect(result.user.email).toBe(email);
            expect(result.token).toBe('mock_token');
            expect(mockBcrypt.compare).toHaveBeenCalledWith(password, 'hashed_password');
        });

        it('should throw error if user not found', async () => {
            const email = 'nonexistent@example.com';
            const password = 'password123';

            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            await expect(authService.login(email, password)).rejects.toThrow(
                'Invalid email or password'
            );
        });

        it('should throw error if account is inactive', async () => {
            const email = 'test@example.com';
            const password = 'password123';

            mockDb.query.mockResolvedValueOnce({
                rows: [{
                    id: '123',
                    email,
                    password_hash: 'hashed_password',
                    full_name: 'Test User',
                    role: 'professional',
                    is_active: false
                }]
            } as never);

            await expect(authService.login(email, password)).rejects.toThrow(
                'Account is inactive'
            );
        });

        it('should throw error if password is invalid', async () => {
            const email = 'test@example.com';
            const password = 'wrongpassword';

            mockDb.query.mockResolvedValueOnce({
                rows: [{
                    id: '123',
                    email,
                    password_hash: 'hashed_password',
                    full_name: 'Test User',
                    role: 'professional',
                    is_active: true
                }]
            } as never);

            mockBcrypt.compare.mockResolvedValue(false as never);

            await expect(authService.login(email, password)).rejects.toThrow(
                'Invalid email or password'
            );
        });
    });

    describe('getUserById', () => {
        it('should return user if found', async () => {
            const userId = '123';

            mockDb.query.mockResolvedValueOnce({
                rows: [{
                    id: userId,
                    email: 'test@example.com',
                    full_name: 'Test User',
                    role: 'professional',
                    is_active: true,
                    email_verified: false,
                    created_at: new Date()
                }]
            } as never);

            const result = await authService.getUserById(userId);

            expect(result.id).toBe(userId);
            expect(result.email).toBe('test@example.com');
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                [userId]
            );
        });

        it('should throw error if user not found', async () => {
            const userId = 'nonexistent';

            mockDb.query.mockResolvedValueOnce({ rows: [] } as never);

            await expect(authService.getUserById(userId)).rejects.toThrow('User not found');
        });
    });
});
