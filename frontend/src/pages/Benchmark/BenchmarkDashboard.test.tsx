import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import BenchmarkDashboard from './BenchmarkDashboard';
import { benchmarkAPI, knowledgeBaseAPI } from '../../services/api';

// Mock the APIs
vi.mock('../../services/api', () => ({
  knowledgeBaseAPI: {
    getMyKnowledgeBase: vi.fn(),
  },
  benchmarkAPI: {
    listDatasets: vi.fn(),
    listRuns: vi.fn(),
    listQuestions: vi.fn(),
    createDataset: vi.fn(),
    deleteDataset: vi.fn(),
    exportDataset: vi.fn(),
    createRun: vi.fn(),
    startRun: vi.fn(),
    deleteRun: vi.fn(),
    getRunResults: vi.fn(),
    addQuestion: vi.fn(),
    deleteQuestion: vi.fn(),
    generateQuestions: vi.fn(),
  },
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
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

describe('BenchmarkDashboard', () => {
  const mockTwin = {
    id: 'twin-123',
    name: 'Test Twin',
  };

  const mockDatasets = [
    {
      id: 'ds-1',
      name: 'Golden Dataset',
      description: 'Test dataset',
      dataset_type: 'golden',
      total_questions: 25,
      created_at: '2024-01-15T10:00:00Z',
    },
  ];

  const mockRuns = [
    {
      id: 'run-1',
      name: 'Baseline v1',
      status: 'completed',
      dataset_name: 'Golden Dataset',
      run_type: 'full',
      created_at: '2024-01-15T10:00:00Z',
      aggregate_metrics: {
        retrieval: { context_precision: 0.85 },
        overall: { success_rate: 0.92, total_questions: 25 },
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();

    (knowledgeBaseAPI.getMyKB as Mock).mockResolvedValue({
      data: { twin: mockTwin },
    });
    (benchmarkAPI.listDatasets as Mock).mockResolvedValue({
      data: mockDatasets,
    });
    (benchmarkAPI.listRuns as Mock).mockResolvedValue({
      data: mockRuns,
    });
  });

  const renderDashboard = (): ReturnType<typeof render> => {
    return render(
      <BrowserRouter>
        <BenchmarkDashboard />
      </BrowserRouter>
    );
  };

  it('renders loading state initially', () => {
    const { container } = renderDashboard();

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders dashboard header after loading', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('RAG Benchmark')).toBeInTheDocument();
    });
    expect(screen.getByText('Test and optimize your knowledge base')).toBeInTheDocument();
  });

  it('renders action buttons in header', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('New Dataset')).toBeInTheDocument();
      expect(screen.getByText('Run Benchmark')).toBeInTheDocument();
    });
  });

  it('renders tabs for navigation', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByText('Datasets').length).toBeGreaterThan(0);
      expect(screen.getByText('Runs')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });

  it('shows datasets tab by default', async () => {
    renderDashboard();

    await waitFor(() => {
      // Default tab is now datasets, check for the datasets header
      expect(screen.getAllByText('Datasets').length).toBeGreaterThan(0);
      expect(screen.getByText('Questions')).toBeInTheDocument();
    });
  });

  it('displays dataset list on datasets tab', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Golden Dataset')).toBeInTheDocument();
    });
  });

  it('displays datasets with questions section', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Golden Dataset')).toBeInTheDocument();
      expect(screen.getByText('Select a dataset to view questions')).toBeInTheDocument();
    });
  });

  it('navigates to runs tab', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Runs')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Runs'));

    await waitFor(() => {
      expect(screen.getByText('Benchmark Runs')).toBeInTheDocument();
    });
  });

  it('opens create dataset modal', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('New Dataset')).toBeInTheDocument();
    });

    await user.click(screen.getByText('New Dataset'));

    await waitFor(() => {
      expect(screen.getByText('Create Dataset')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('My Test Dataset')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Optional description')).toBeInTheDocument();
      expect(screen.getByText('Golden (manual)')).toBeInTheDocument();
    });
  });

  it('creates a new dataset', async () => {
    const user = userEvent.setup();
    (benchmarkAPI.createDataset as Mock).mockResolvedValue({ data: { id: 'new-ds' } });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('New Dataset')).toBeInTheDocument();
    });

    await user.click(screen.getByText('New Dataset'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('My Test Dataset')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('My Test Dataset'), 'My New Dataset');
    await user.type(screen.getByPlaceholderText('Optional description'), 'A test description');

    // Find and click Create button in modal
    const createButtons = screen.getAllByText('Create');
    await user.click(createButtons[createButtons.length - 1]); // Click the modal's Create button

    await waitFor(() => {
      expect(benchmarkAPI.createDataset).toHaveBeenCalledWith({
        twin_id: 'twin-123',
        name: 'My New Dataset',
        description: 'A test description',
        dataset_type: 'golden',
      });
    });
  });

  it('opens create run modal', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Run Benchmark')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Run Benchmark'));

    await waitFor(() => {
      expect(screen.getByText('Create Benchmark Run')).toBeInTheDocument();
      expect(screen.getByText('Select dataset...')).toBeInTheDocument();
    });
  });

  it('redirects to onboarding if no twin exists', async () => {
    (knowledgeBaseAPI.getMyKB as Mock).mockRejectedValue({
      response: { status: 404 },
    });

    renderDashboard();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
    });
  });

  it('shows error toast on API failure', async () => {
    (knowledgeBaseAPI.getMyKB as Mock).mockRejectedValue(new Error('Network error'));
    const toast = await import('react-hot-toast');

    renderDashboard();

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Failed to load data');
    });
  });

  it('displays run metrics when completed run is selected', async () => {
    const user = userEvent.setup();
    (benchmarkAPI.getRunResults as Mock).mockResolvedValue({ data: [] });
    renderDashboard();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Runs')).toBeInTheDocument();
    });

    // Navigate to runs tab first
    await user.click(screen.getByText('Runs'));

    await waitFor(() => {
      expect(screen.getByText('Benchmark Runs')).toBeInTheDocument();
    });
  });

  it('closes modal when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('New Dataset')).toBeInTheDocument();
    });

    await user.click(screen.getByText('New Dataset'));

    await waitFor(() => {
      expect(screen.getByText('Create Dataset')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Create Dataset')).not.toBeInTheDocument();
    });
  });

  it('shows validation error for empty dataset name', async () => {
    const user = userEvent.setup();
    const toast = await import('react-hot-toast');

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('New Dataset')).toBeInTheDocument();
    });

    await user.click(screen.getByText('New Dataset'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('My Test Dataset')).toBeInTheDocument();
    });

    // Click Create without filling name
    const createButtons = screen.getAllByText('Create');
    await user.click(createButtons[createButtons.length - 1]);

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Dataset name is required');
    });
  });
});
