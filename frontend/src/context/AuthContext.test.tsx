import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { authAPI } from '../services/api';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the API
vi.mock('../services/api', () => ({
    authAPI: {
        login: vi.fn(),
        register: vi.fn(),
        getMe: vi.fn(),
    },
}));

// Test component to consume context
const TestComponent = () => {
    const { user, login, logout, isAuthenticated } = useAuth();
    return (
        <div>
            <div data-testid="auth-status">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
            <div data-testid="user-email">{user?.email}</div>
            <button onClick={() => login('test@example.com', 'password')}>Login</button>
            <button onClick={logout}>Logout</button>
        </div>
    );
};

describe('AuthContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('provides initial state', async () => {
        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
    });

    it('handles login success', async () => {
        const mockUser = { id: '1', email: 'test@example.com', full_name: 'Test User', role: 'professional' };
        vi.mocked(authAPI.login).mockResolvedValue({
            data: { user: mockUser, token: 'mock-token' },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
        });

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        await act(async () => {
            screen.getByText('Login').click();
        });

        await waitFor(() => {
            expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
            expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
        });

        expect(localStorage.getItem('token')).toBe('mock-token');
    });

    it('handles logout', async () => {
        // Setup initial logged in state
        const mockUser = { id: '1', email: 'test@example.com', full_name: 'Test User', role: 'professional' };
        localStorage.setItem('token', 'mock-token');
        localStorage.setItem('user', JSON.stringify(mockUser));
        vi.mocked(authAPI.getMe).mockResolvedValue({
            data: { user: mockUser },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
        });

        render(
            <AuthProvider>
                <TestComponent />
            </AuthProvider>
        );

        // Wait for init
        await waitFor(() => {
            expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
        });

        // Logout
        await act(async () => {
            screen.getByText('Logout').click();
        });

        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
        expect(localStorage.getItem('token')).toBeNull();
    });
});
