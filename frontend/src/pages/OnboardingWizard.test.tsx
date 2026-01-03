import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import OnboardingWizard from './OnboardingWizard';
import { AuthProvider } from '../context/AuthContext';
import { knowledgeBaseAPI } from '../services/api';

// Mock the API
vi.mock('../services/api', () => ({
  knowledgeBaseAPI: {
    create: vi.fn(),
    getMyKB: vi.fn(),
  },
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => {
  const mockError = vi.fn();
  const mockSuccess = vi.fn();
  return {
    default: {
      error: mockError,
      success: mockSuccess,
      info: vi.fn(),
    },
    error: mockError,
    success: mockSuccess,
    info: vi.fn(),
  };
});

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('OnboardingWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();

    // Mock getMyKB to return 404 (no existing knowledge base)
    (knowledgeBaseAPI.getMyKB as Mock).mockRejectedValue({
      response: { status: 404 }
    });
  });

  const renderOnboardingWizard = () => {
    return render(
      <BrowserRouter>
        <AuthProvider>
          <OnboardingWizard />
        </AuthProvider>
      </BrowserRouter>
    );
  };

  it('renders correctly with required fields', async () => {
    renderOnboardingWizard();

    await waitFor(() => {
      expect(screen.getByText(/Welcome!/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Knowledge Base Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/AI Provider/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Model/i)).toBeInTheDocument();
  });

  it('redirects if user already has a knowledge base', async () => {
    (knowledgeBaseAPI.getMyKB as Mock).mockResolvedValue({
      data: { knowledgeBase: { id: 'kb-1' } }
    });

    renderOnboardingWizard();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('validates that knowledge base name is required', async () => {
    const user = userEvent.setup();
    const { container } = renderOnboardingWizard();

    await waitFor(() => {
      expect(screen.getByText(/Welcome!/i)).toBeInTheDocument();
    });

    // Clear default name
    const nameInput = screen.getByLabelText(/Knowledge Base Name/i);
    await user.clear(nameInput);

    // Submit form
    const form = container.querySelector('form');
    fireEvent.submit(form!);

    const toast = await import('react-hot-toast');
    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Please enter a name for your knowledge base');
    });
  });

  it('updates models when AI provider changes', async () => {
    renderOnboardingWizard();

    await waitFor(() => {
      expect(screen.getByText(/Welcome!/i)).toBeInTheDocument();
    });

    const providerSelect = screen.getByLabelText(/AI Provider/i);
    const modelSelect = screen.getByLabelText(/Model/i);

    // Default is OpenAI -> GPT-4
    expect(modelSelect).toHaveValue('gpt-4');

    // Change to Anthropic
    fireEvent.change(providerSelect, { target: { value: 'anthropic' } });
    expect(modelSelect).toHaveValue('claude-3-5-sonnet-20241022');

    // Change to Gemini
    fireEvent.change(providerSelect, { target: { value: 'gemini' } });
    expect(modelSelect).toHaveValue('gemini-pro');
  });

  it('creates knowledge base successfully', async () => {
    const user = userEvent.setup();
    (knowledgeBaseAPI.create as Mock).mockResolvedValue({
      data: { knowledgeBase: { id: 'new-kb' } }
    });

    renderOnboardingWizard();

    await waitFor(() => {
      expect(screen.getByText(/Welcome!/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Knowledge Base Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Brand New KB');

    const submitButton = screen.getByRole('button', { name: /Create Knowledge Base/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(knowledgeBaseAPI.create).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Brand New KB',
      }));
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('navigates to dashboard when skip button is clicked', async () => {
    const user = userEvent.setup();
    renderOnboardingWizard();

    await waitFor(() => {
      expect(screen.getByText(/Welcome!/i)).toBeInTheDocument();
    });

    const skipButton = screen.getByRole('button', { name: /Skip for now/i });
    await user.click(skipButton);

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});
