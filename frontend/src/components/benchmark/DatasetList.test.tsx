import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DatasetList from './DatasetList';

interface Dataset {
  id: string;
  name: string;
  description?: string;
  dataset_type: string;
  total_questions?: number;
  active_questions?: number;
  created_at: string;
}

describe('DatasetList', () => {
  const mockDatasets: Dataset[] = [
    {
      id: 'ds-1',
      name: 'Golden Dataset',
      description: 'Hand-curated test questions',
      dataset_type: 'golden',
      total_questions: 25,
      created_at: '2024-01-15T10:00:00Z',
    },
    {
      id: 'ds-2',
      name: 'Synthetic Dataset',
      description: 'Auto-generated questions',
      dataset_type: 'synthetic',
      total_questions: 100,
      created_at: '2024-01-20T14:30:00Z',
    },
    {
      id: 'ds-3',
      name: 'Hybrid Dataset',
      dataset_type: 'hybrid',
      active_questions: 50,
      created_at: '2024-01-25T09:15:00Z',
    },
  ];

  const mockOnSelect = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnExport = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    render(<DatasetList datasets={[]} loading={true} />);

    expect(screen.getByText('Loading datasets...')).toBeInTheDocument();
  });

  it('renders empty state when no datasets', () => {
    render(<DatasetList datasets={[]} />);

    expect(screen.getByText('No datasets yet. Create one to get started.')).toBeInTheDocument();
  });

  it('renders list of datasets', () => {
    render(<DatasetList datasets={mockDatasets} onSelect={mockOnSelect} />);

    expect(screen.getByText('Golden Dataset')).toBeInTheDocument();
    expect(screen.getByText('Synthetic Dataset')).toBeInTheDocument();
    expect(screen.getByText('Hybrid Dataset')).toBeInTheDocument();
  });

  it('displays dataset descriptions', () => {
    render(<DatasetList datasets={mockDatasets} onSelect={mockOnSelect} />);

    expect(screen.getByText('Hand-curated test questions')).toBeInTheDocument();
    expect(screen.getByText('Auto-generated questions')).toBeInTheDocument();
  });

  it('displays dataset type badges', () => {
    render(<DatasetList datasets={mockDatasets} onSelect={mockOnSelect} />);

    expect(screen.getByText('golden')).toBeInTheDocument();
    expect(screen.getByText('synthetic')).toBeInTheDocument();
    expect(screen.getByText('hybrid')).toBeInTheDocument();
  });

  it('displays question counts', () => {
    render(<DatasetList datasets={mockDatasets} onSelect={mockOnSelect} />);

    expect(screen.getByText('25 questions')).toBeInTheDocument();
    expect(screen.getByText('100 questions')).toBeInTheDocument();
    expect(screen.getByText('50 questions')).toBeInTheDocument();
  });

  it('calls onSelect when dataset is clicked', async () => {
    const user = userEvent.setup();
    render(<DatasetList datasets={mockDatasets} onSelect={mockOnSelect} />);

    await user.click(screen.getByText('Golden Dataset'));

    expect(mockOnSelect).toHaveBeenCalledWith(mockDatasets[0]);
  });

  it('highlights selected dataset', () => {
    const { container } = render(
      <DatasetList
        datasets={mockDatasets}
        selectedId="ds-1"
        onSelect={mockOnSelect}
      />
    );

    const selectedItem = container.querySelector('.border-blue-500');
    expect(selectedItem).toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <DatasetList
        datasets={mockDatasets}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
      />
    );

    const deleteButtons = screen.getAllByTitle('Delete dataset');
    await user.click(deleteButtons[0]);

    expect(mockOnDelete).toHaveBeenCalledWith(mockDatasets[0]);
  });

  it('does not call onDelete when confirm is cancelled', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <DatasetList
        datasets={mockDatasets}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
      />
    );

    const deleteButtons = screen.getAllByTitle('Delete dataset');
    await user.click(deleteButtons[0]);

    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it('calls onExport when export button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <DatasetList
        datasets={mockDatasets}
        onSelect={mockOnSelect}
        onExport={mockOnExport}
      />
    );

    const exportButtons = screen.getAllByTitle('Export dataset');
    await user.click(exportButtons[0]);

    expect(mockOnExport).toHaveBeenCalledWith(mockDatasets[0]);
  });

  it('does not show delete button when onDelete is not provided', () => {
    render(<DatasetList datasets={mockDatasets} onSelect={mockOnSelect} />);

    expect(screen.queryByTitle('Delete dataset')).not.toBeInTheDocument();
  });

  it('does not show export button when onExport is not provided', () => {
    render(<DatasetList datasets={mockDatasets} onSelect={mockOnSelect} />);

    expect(screen.queryByTitle('Export dataset')).not.toBeInTheDocument();
  });

  it('stops propagation when delete is clicked', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <DatasetList
        datasets={mockDatasets}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
      />
    );

    const deleteButtons = screen.getAllByTitle('Delete dataset');
    await user.click(deleteButtons[0]);

    // onSelect should not be called when delete is clicked
    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it('handles null datasets gracefully', () => {
    render(<DatasetList datasets={null as unknown as Dataset[]} />);

    expect(screen.getByText('No datasets yet. Create one to get started.')).toBeInTheDocument();
  });
});
