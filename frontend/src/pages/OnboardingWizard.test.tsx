import { render, screen, waitFor } from '@testing-library/react';
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
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
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

describe('OnboardingWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();

    // Mock getMyTwin to return 404 (no existing twin)
    (knowledgeBaseAPI.getMyKB as Mock).mockRejectedValue({
      response: { status: 404 }
    });
  });

  it('renders step 1 with required fields', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <OnboardingWizard />
        </AuthProvider>
      </BrowserRouter>
    );

    // Wait for the existing twin check to complete
    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Knowledge Base Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Profession/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Bio \/ About You/i)).toBeInTheDocument();
  });

  it('validates required fields on step 1', async () => {
    const user = userEvent.setup();
    const toast = await import('react-hot-toast');

    render(
      <BrowserRouter>
        <AuthProvider>
          <OnboardingWizard />
        </AuthProvider>
      </BrowserRouter>
    );

    // Wait for the existing twin check to complete
    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });

    // Try to go to next step without filling required fields
    const nextButton = screen.getByRole('button', { name: /Next/i });
    await user.click(nextButton);

    // Should show error for name
    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Knowledge Base Name is required');
    }, { timeout: 10000 });
  });

  it('allows navigation when required fields are filled', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AuthProvider>
          <OnboardingWizard />
        </AuthProvider>
      </BrowserRouter>
    );

    // Wait for the existing twin check to complete
    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });

    // Fill required fields
    await user.type(screen.getByLabelText(/Knowledge Base Name/i), 'Coach John AI');
    await user.type(screen.getByLabelText(/Profession/i), 'Life Coach');

    // Click next
    const nextButton = screen.getByRole('button', { name: /Next/i });
    await user.click(nextButton);

    // Should navigate to step 2
    await waitFor(() => {
      expect(screen.getByText('AI Configuration')).toBeInTheDocument();
    });
  });

  it('has 4 steps in total', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <OnboardingWizard />
        </AuthProvider>
      </BrowserRouter>
    );

    // Wait for the existing twin check to complete
    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });

    // Check progress bar has 4 steps
    const steps = screen.getAllByText(/^[1-4]$/);
    expect(steps).toHaveLength(4);
  });

  it('shows capabilities on step 4', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <AuthProvider>
          <OnboardingWizard />
        </AuthProvider>
      </BrowserRouter>
    );

    // Wait for the existing twin check to complete
    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });

    // Fill step 1
    await user.type(screen.getByLabelText(/Knowledge Base Name/i), 'Coach John AI');
    await user.type(screen.getByLabelText(/Profession/i), 'Life Coach');
    await user.click(screen.getByRole('button', { name: /Next/i }));

    // Skip step 2
    await waitFor(() => {
      expect(screen.getByText('AI Configuration')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Next/i }));

    // Skip step 3
    await waitFor(() => {
      expect(screen.getByText('Personality Traits')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Next/i }));

    // Should show capabilities on step 4
    await waitFor(() => {
      expect(screen.getByText('Capabilities')).toBeInTheDocument();
      expect(screen.getByText(/What should your knowledge base be able to do/i)).toBeInTheDocument();
    });
  });

  it('creates knowledge base successfully', async () => {
    const user = userEvent.setup();
    const mockTwin = {
      id: 'twin-123',
      name: 'Coach John AI',
      profession: 'Life Coach',
    };

    (knowledgeBaseAPI.create as Mock).mockResolvedValue({
      data: { twin: mockTwin },
    });

    render(
      <BrowserRouter>
        <AuthProvider>
          <OnboardingWizard />
        </AuthProvider>
      </BrowserRouter>
    );

    // Wait for the existing twin check to complete
    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
    });

    // Fill step 1
    await user.type(screen.getByLabelText(/Knowledge Base Name/i), 'Coach John AI');
    await user.type(screen.getByLabelText(/Profession/i), 'Life Coach');
    await user.click(screen.getByRole('button', { name: /Next/i }));

    // Skip to step 4
    await waitFor(() => screen.getByText('AI Configuration'));
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await waitFor(() => screen.getByText('Personality Traits'));
    await user.click(screen.getByRole('button', { name: /Next/i }));
    await waitFor(() => screen.getByText('Capabilities'));

    // Complete setup
    const completeButton = screen.getByRole('button', { name: /Complete Setup/i });
    await user.click(completeButton);

    await waitFor(() => {
      expect(knowledgeBaseAPI.create).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });
});
