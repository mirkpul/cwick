import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MetricsGrid from './MetricsGrid';

interface Metrics {
  retrieval: {
    context_precision?: number;
    context_recall?: number;
    mrr?: number;
    ndcg?: number;
    hit_rate?: number;
    avg_latency_ms?: number;
  };
  generation: {
    faithfulness?: number;
    answer_relevance?: number;
    semantic_similarity?: number;
    avg_latency_ms?: number;
  };
  overall: {
    success_rate?: number;
    total_questions?: number;
    successful?: number;
    avg_total_latency_ms?: number;
  };
}

interface Comparison {
  [key: string]: {
    pct_change: number;
  };
}

describe('MetricsGrid', () => {
  const mockMetrics: Metrics = {
    retrieval: {
      context_precision: 0.85,
      context_recall: 0.78,
      mrr: 0.92,
      ndcg: 0.88,
      hit_rate: 0.95,
      avg_latency_ms: 150,
    },
    generation: {
      faithfulness: 0.82,
      answer_relevance: 0.79,
      semantic_similarity: 0.65,
      avg_latency_ms: 1800,
    },
    overall: {
      success_rate: 0.96,
      total_questions: 50,
      successful: 48,
      avg_total_latency_ms: 2500,
    },
  };

  it('renders null when no metrics provided', () => {
    const { container } = render(<MetricsGrid metrics={null} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders retrieval metrics section', () => {
    render(<MetricsGrid metrics={mockMetrics} />);

    expect(screen.getByText('Retrieval Metrics')).toBeInTheDocument();
    expect(screen.getByText('Precision')).toBeInTheDocument();
    expect(screen.getByText('Recall')).toBeInTheDocument();
    expect(screen.getByText('MRR')).toBeInTheDocument();
    expect(screen.getByText('NDCG')).toBeInTheDocument();
    expect(screen.getByText('Hit Rate')).toBeInTheDocument();
    expect(screen.getByText('Latency')).toBeInTheDocument();
  });

  it('renders generation metrics section when data exists', () => {
    render(<MetricsGrid metrics={mockMetrics} />);

    expect(screen.getByText('Generation Metrics')).toBeInTheDocument();
    expect(screen.getByText('Faithfulness')).toBeInTheDocument();
    expect(screen.getByText('Relevance')).toBeInTheDocument();
    expect(screen.getByText('Similarity')).toBeInTheDocument();
    expect(screen.getByText('Gen Latency')).toBeInTheDocument();
  });

  it('hides generation metrics when values are zero', () => {
    const metricsWithoutGeneration: Metrics = {
      ...mockMetrics,
      generation: {
        faithfulness: 0,
        answer_relevance: 0,
        semantic_similarity: 0,
        avg_latency_ms: 0,
      },
    };

    render(<MetricsGrid metrics={metricsWithoutGeneration} />);

    expect(screen.queryByText('Generation Metrics')).not.toBeInTheDocument();
  });

  it('renders overall metrics section', () => {
    render(<MetricsGrid metrics={mockMetrics} />);

    expect(screen.getByText('Overall')).toBeInTheDocument();
    expect(screen.getByText('Success Rate')).toBeInTheDocument();
    expect(screen.getByText('Questions')).toBeInTheDocument();
    expect(screen.getByText('Successful')).toBeInTheDocument();
    expect(screen.getByText('Total Latency')).toBeInTheDocument();
  });

  it('displays correct precision value', () => {
    render(<MetricsGrid metrics={mockMetrics} />);

    // 85.0% for context_precision of 0.85
    expect(screen.getByText('85.0%')).toBeInTheDocument();
  });

  it('displays correct total questions', () => {
    render(<MetricsGrid metrics={mockMetrics} />);

    // format="number" produces "50.00"
    expect(screen.getByText('50.00')).toBeInTheDocument();
  });

  it('displays correct successful count', () => {
    render(<MetricsGrid metrics={mockMetrics} />);

    // format="number" produces "48.00"
    expect(screen.getByText('48.00')).toBeInTheDocument();
  });

  it('renders with comparison data', () => {
    const comparison: Comparison = {
      'retrieval.context_precision': { pct_change: 5 },
      'retrieval.context_recall': { pct_change: -3 },
    };

    render(<MetricsGrid metrics={mockMetrics} comparison={comparison} />);

    // Should show change indicators with one decimal
    expect(screen.getByText('+5.0%')).toBeInTheDocument();
    expect(screen.getByText('-3.0%')).toBeInTheDocument();
  });

  it('handles missing retrieval data gracefully', () => {
    const partialMetrics: Metrics = {
      retrieval: {},
      generation: {},
      overall: {
        success_rate: 0.9,
        total_questions: 10,
        successful: 9,
      },
    };

    render(<MetricsGrid metrics={partialMetrics} />);

    expect(screen.getByText('Overall')).toBeInTheDocument();
    expect(screen.getByText('Success Rate')).toBeInTheDocument();
  });
});
