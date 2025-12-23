import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Login from './Login';
import { AuthProvider } from '../context/AuthContext';
import { authAPI } from '../services/api';

// Mock the API
vi.mock('../services/api', () => ({
    authAPI: {
        login: vi.fn(),
        getMe: vi.fn(),
    },
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
        dismiss: vi.fn(),
        custom: vi.fn(),
    },
}));

// Mock ErrorToast
vi.mock('../components/ErrorToast', () => ({
    showErrorToast: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('Login Page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockNavigate.mockClear();
    });

    it('renders login form', () => {
        render(
            <BrowserRouter>
                <AuthProvider>
                    <Login />
                </AuthProvider>
            </BrowserRouter>
        );

        expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('handles successful login and navigation', async () => {
        const user = userEvent.setup();
        const mockUser = {
            id: '1',
            email: 'test@example.com',
            full_name: 'Test User',
            role: 'professional',
        };

        vi.mocked(authAPI.login).mockResolvedValue({
            data: { user: mockUser, token: 'mock-token' },
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
        });

        render(
            <BrowserRouter>
                <AuthProvider>
                    <Login />
                </AuthProvider>
            </BrowserRouter>
        );

        await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
        await user.type(screen.getByLabelText(/password/i), 'password123');
        await user.click(screen.getByRole('button', { name: /sign in/i }));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
        });
    });

    it('displays error on failed login', async () => {
        const user = userEvent.setup();
        vi.mocked(authAPI.login).mockRejectedValue({
            response: { data: { error: 'Invalid credentials' } },
        });

        render(
            <BrowserRouter>
                <AuthProvider>
                    <Login />
                </AuthProvider>
            </BrowserRouter>
        );

        await user.type(screen.getByLabelText(/email address/i), 'wrong@example.com');
        await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
        await user.click(screen.getByRole('button', { name: /sign in/i }));

        await waitFor(() => {
            expect(mockNavigate).not.toHaveBeenCalled();
        });
    });
});
