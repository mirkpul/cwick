import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MetricCard from './MetricCard';

describe('MetricCard', () => {
  it('renders title and percentage value correctly', () => {
    render(<MetricCard title="Precision" value={0.85} />);

    expect(screen.getByText('Precision')).toBeInTheDocument();
    expect(screen.getByText('85.0%')).toBeInTheDocument();
  });

  it('renders null value as dash', () => {
    render(<MetricCard title="Recall" value={null} />);

    expect(screen.getByText('Recall')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('renders undefined value as dash', () => {
    render(<MetricCard title="MRR" value={undefined} />);

    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('formats milliseconds correctly', () => {
    render(<MetricCard title="Latency" value={1250} format="ms" />);

    expect(screen.getByText('1250ms')).toBeInTheDocument();
  });

  it('formats milliseconds as rounded value', () => {
    render(<MetricCard title="Latency" value={3500} format="ms" />);

    expect(screen.getByText('3500ms')).toBeInTheDocument();
  });

  it('formats number with two decimals', () => {
    render(<MetricCard title="Questions" value={42} format="number" />);

    expect(screen.getByText('42.00')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<MetricCard title="Hit Rate" value={0.9} description="Queries with hits" />);

    expect(screen.getByText('Queries with hits')).toBeInTheDocument();
  });

  it('applies green background color class', () => {
    const { container } = render(<MetricCard title="Precision" value={0.85} color="green" />);

    expect(container.querySelector('.bg-green-50')).toBeInTheDocument();
  });

  it('applies yellow background color class', () => {
    const { container } = render(<MetricCard title="Precision" value={0.65} color="yellow" />);

    expect(container.querySelector('.bg-yellow-50')).toBeInTheDocument();
  });

  it('applies red background color class', () => {
    const { container } = render(<MetricCard title="Precision" value={0.4} color="red" />);

    expect(container.querySelector('.bg-red-50')).toBeInTheDocument();
  });

  it('shows positive change indicator', () => {
    render(<MetricCard title="Precision" value={0.85} change={10} />);

    expect(screen.getByText('+10.0%')).toBeInTheDocument();
  });

  it('shows negative change indicator', () => {
    render(<MetricCard title="Precision" value={0.75} change={-5} />);

    expect(screen.getByText('-5.0%')).toBeInTheDocument();
  });

  it('renders with small size padding', () => {
    const { container } = render(<MetricCard title="Test" value={0.5} size="small" />);

    expect(container.querySelector('.p-2')).toBeInTheDocument();
  });

  it('renders with default size padding', () => {
    const { container } = render(<MetricCard title="Test" value={0.5} size="default" />);

    expect(container.querySelector('.p-4')).toBeInTheDocument();
  });

  it('renders with large size padding', () => {
    const { container } = render(<MetricCard title="Test" value={0.5} size="large" />);

    expect(container.querySelector('.p-6')).toBeInTheDocument();
  });

  it('applies default blue color when no color specified', () => {
    const { container } = render(<MetricCard title="Test" value={0.5} />);

    expect(container.querySelector('.bg-blue-50')).toBeInTheDocument();
  });
});
