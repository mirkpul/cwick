import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QuestionsList from './QuestionsList';

interface Question {
  id: string;
  question: string;
  expected_answer?: string;
  question_type: string;
  difficulty: string;
  source_type?: string;
  expected_context_ids?: string[];
  tags?: string[];
}

describe('QuestionsList', () => {
  const mockQuestions: Question[] = [
    {
      id: 'q-1',
      question: 'What is the capital of France?',
      expected_answer: 'Paris is the capital of France.',
      question_type: 'simple',
      difficulty: 'easy',
      source_type: 'manual',
      expected_context_ids: ['doc-1', 'doc-2'],
      tags: ['geography', 'europe'],
    },
    {
      id: 'q-2',
      question: 'Explain the process of photosynthesis and its importance in the ecosystem.',
      expected_answer: 'Photosynthesis is the process by which plants convert sunlight into energy...',
      question_type: 'complex',
      difficulty: 'medium',
      source_type: 'synthetic',
    },
    {
      id: 'q-3',
      question: 'How does climate change affect biodiversity, and what are the economic implications?',
      question_type: 'multi_hop',
      difficulty: 'hard',
      source_type: 'manual',
    },
  ];

  const mockOnDelete = vi.fn();
  const mockOnEdit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    render(<QuestionsList questions={[]} loading={true} />);

    expect(screen.getByText('Loading questions...')).toBeInTheDocument();
  });

  it('renders empty state when no questions', () => {
    render(<QuestionsList questions={[]} />);

    expect(screen.getByText('No questions in this dataset yet.')).toBeInTheDocument();
  });

  it('renders list of questions', () => {
    render(<QuestionsList questions={mockQuestions} />);

    expect(screen.getByText('What is the capital of France?')).toBeInTheDocument();
    expect(screen.getByText(/Explain the process of photosynthesis/)).toBeInTheDocument();
    expect(screen.getByText(/How does climate change affect biodiversity/)).toBeInTheDocument();
  });

  it('displays question numbers', () => {
    render(<QuestionsList questions={mockQuestions} />);

    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();
  });

  it('displays question type badges', () => {
    render(<QuestionsList questions={mockQuestions} />);

    expect(screen.getByText('simple')).toBeInTheDocument();
    expect(screen.getByText('complex')).toBeInTheDocument();
    expect(screen.getByText('multi_hop')).toBeInTheDocument();
  });

  it('displays difficulty badges', () => {
    render(<QuestionsList questions={mockQuestions} />);

    expect(screen.getByText('easy')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(screen.getByText('hard')).toBeInTheDocument();
  });

  it('displays synthetic badge for synthetic questions', () => {
    render(<QuestionsList questions={mockQuestions} />);

    expect(screen.getByText('synthetic')).toBeInTheDocument();
  });

  it('expands question to show details when clicked', async () => {
    const user = userEvent.setup();
    render(<QuestionsList questions={mockQuestions} />);

    // Initially, expected answer should not be visible
    expect(screen.queryByText('Expected Answer')).not.toBeInTheDocument();

    // Click on the first question
    await user.click(screen.getByText('What is the capital of France?'));

    // Now expected answer should be visible
    expect(screen.getByText('Expected Answer')).toBeInTheDocument();
    expect(screen.getByText('Paris is the capital of France.')).toBeInTheDocument();
  });

  it('shows expected context IDs when expanded', async () => {
    const user = userEvent.setup();
    render(<QuestionsList questions={mockQuestions} />);

    await user.click(screen.getByText('What is the capital of France?'));

    expect(screen.getByText('Expected Context IDs')).toBeInTheDocument();
    expect(screen.getByText('doc-1, doc-2')).toBeInTheDocument();
  });

  it('shows tags when expanded', async () => {
    const user = userEvent.setup();
    render(<QuestionsList questions={mockQuestions} />);

    await user.click(screen.getByText('What is the capital of France?'));

    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('geography')).toBeInTheDocument();
    expect(screen.getByText('europe')).toBeInTheDocument();
  });

  it('collapses question when clicked again', async () => {
    const user = userEvent.setup();
    render(<QuestionsList questions={mockQuestions} />);

    // Expand
    await user.click(screen.getByText('What is the capital of France?'));
    expect(screen.getByText('Expected Answer')).toBeInTheDocument();

    // Collapse
    await user.click(screen.getByText('What is the capital of France?'));
    expect(screen.queryByText('Expected Answer')).not.toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<QuestionsList questions={mockQuestions} onDelete={mockOnDelete} />);

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(mockOnDelete).toHaveBeenCalledWith(mockQuestions[0]);
  });

  it('does not call onDelete when confirm is cancelled', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<QuestionsList questions={mockQuestions} onDelete={mockOnDelete} />);

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it('calls onEdit when edit button is clicked', async () => {
    const user = userEvent.setup();

    render(<QuestionsList questions={mockQuestions} onEdit={mockOnEdit} />);

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    expect(mockOnEdit).toHaveBeenCalledWith(mockQuestions[0]);
  });

  it('does not show delete button when onDelete is not provided', () => {
    render(<QuestionsList questions={mockQuestions} />);

    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
  });

  it('does not show edit button when onEdit is not provided', () => {
    render(<QuestionsList questions={mockQuestions} />);

    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument();
  });

  it('stops propagation when delete is clicked', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<QuestionsList questions={mockQuestions} onDelete={mockOnDelete} />);

    // Initially collapsed
    expect(screen.queryByText('Expected Answer')).not.toBeInTheDocument();

    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    // Should still be collapsed after delete click
    expect(screen.queryByText('Expected Answer')).not.toBeInTheDocument();
  });

  it('handles null questions gracefully', () => {
    render(<QuestionsList questions={null as unknown as Question[]} />);

    expect(screen.getByText('No questions in this dataset yet.')).toBeInTheDocument();
  });

  it('handles questions without expected_answer', async () => {
    const user = userEvent.setup();
    render(<QuestionsList questions={[mockQuestions[2]]} />);

    await user.click(screen.getByText(/How does climate change/));

    // Should not show Expected Answer section
    expect(screen.queryByText('Expected Answer')).not.toBeInTheDocument();
  });

  it('handles questions without tags', async () => {
    const user = userEvent.setup();
    render(<QuestionsList questions={[mockQuestions[1]]} />);

    await user.click(screen.getByText(/Explain the process/));

    // Should not show Tags section
    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
  });

  it('applies correct color for simple question type', () => {
    const { container } = render(<QuestionsList questions={[mockQuestions[0]]} />);

    const badge = container.querySelector('.bg-green-100');
    expect(badge).toBeInTheDocument();
  });

  it('applies correct color for complex question type', () => {
    const { container } = render(<QuestionsList questions={[mockQuestions[1]]} />);

    const badge = container.querySelector('.bg-blue-100');
    expect(badge).toBeInTheDocument();
  });

  it('applies correct color for multi_hop question type', () => {
    const { container } = render(<QuestionsList questions={[mockQuestions[2]]} />);

    const badge = container.querySelector('.bg-purple-100');
    expect(badge).toBeInTheDocument();
  });
});
