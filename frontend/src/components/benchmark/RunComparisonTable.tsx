import { useState } from 'react';
import { BenchmarkRun as SharedBenchmarkRun } from '../../types/benchmark';

// Re-export for backward compatibility
export type BenchmarkRun = SharedBenchmarkRun;

export interface RunComparisonTableProps {
  runs: BenchmarkRun[];
  onSelectRun: (run: BenchmarkRun) => void;
  onDeleteRun?: (run: BenchmarkRun) => void;
  onCompareRuns?: (runIds: string[]) => void;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

/**
 * RunComparisonTable - Displays a sortable table of benchmark runs with comparison features
 */
export default function RunComparisonTable({
  runs,
  onSelectRun,
  onDeleteRun,
  onCompareRuns
}: RunComparisonTableProps): React.JSX.Element {
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });

  // Handle checking/unchecking runs for comparison
  const handleToggleComparison = (runId: string): void => {
    setSelectedForComparison(prev => {
      if (prev.includes(runId)) {
        return prev.filter(id => id !== runId);
      }
      if (prev.length >= 2) {
        // Can only compare 2 for now, replace the oldest one? Or just don't allow > 2
        return [...prev.slice(1), runId];
      }
      return [...prev, runId];
    });
  };

  // Sort runs
  const sortedRuns = [...runs].sort((a, b) => {
    let aValue: unknown, bValue: unknown;

    // Handle nested metric keys
    if (sortConfig.key.includes('.')) {
      const parts = sortConfig.key.split('.');
      aValue = parts.reduce((obj: unknown, part) => (obj as Record<string, unknown> | undefined)?.[part], a?.aggregate_metrics);
      bValue = parts.reduce((obj: unknown, part) => (obj as Record<string, unknown> | undefined)?.[part], b?.aggregate_metrics);
    } else {
      aValue = (a as unknown as Record<string, unknown>)[sortConfig.key];
      bValue = (b as unknown as Record<string, unknown>)[sortConfig.key];
    }

    if (aValue === undefined || aValue === null) return 1;
    if (bValue === undefined || bValue === null) return -1;
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const requestSort = (key: string): void => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string): string => {
    if (sortConfig.key !== key) return '↕';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Helper to safely format numbers
  const fmt = (num: number | undefined | null, percent = false): string => {
    if (num === undefined || num === null) return '-';
    if (percent) return (num * 100).toFixed(1) + '%';
    return num.toFixed(2);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Action Bar */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <h3 className="font-semibold text-gray-700">Benchmark Runs ({runs.length})</h3>
        <div className="flex gap-2">
          {selectedForComparison.length === 2 && onCompareRuns && (
            <button
              onClick={() => onCompareRuns(selectedForComparison)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              Compare Selected ({selectedForComparison.length})
            </button>
          )}
          <span className="text-sm text-gray-500 self-center">
            {selectedForComparison.length < 2 ? 'Select 2 to compare' : ''}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 px-4 py-3"></th> {/* Checkbox */}
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => requestSort('name')}
              >
                Run Name {getSortIcon('name')}
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => requestSort('created_at')}
              >
                Date {getSortIcon('created_at')}
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => requestSort('overall.success_rate')}
              >
                Success {getSortIcon('overall.success_rate')}
              </th>
              <th
                className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => requestSort('retrieval.context_precision')}
                title="Context Precision: % of retrieved docs that are relevant"
              >
                Prec {getSortIcon('retrieval.context_precision')}
              </th>

              <th
                className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => requestSort('generation.answer_relevance')}
                title="Answer Relevance"
              >
                Rel {getSortIcon('generation.answer_relevance')}
              </th>
              <th
                className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => requestSort('generation.faithfulness')}
                title="Faithfulness"
              >
                Faith {getSortIcon('generation.faithfulness')}
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => requestSort('overall.avg_total_latency_ms')}
              >
                Latency {getSortIcon('overall.avg_total_latency_ms')}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedRuns.map((run) => {
              const m = run.aggregate_metrics || {};
              const isSelected = selectedForComparison.includes(run.id);

              return (
                <tr
                  key={run.id}
                  className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-4 py-4 whitespace-nowrap">
                    {run.status === 'completed' && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleComparison(run.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-blue-600 cursor-pointer hover:underline" onClick={() => onSelectRun(run)}>
                        {run.name || 'Unnamed Run'}
                      </div>

                      <div className="text-xs text-gray-500">
                        {run.dataset_name}
                        {run.status !== 'completed' && (
                          <span className={`ml-2 px-1.5 inline-flex text-xs leading-4 font-semibold rounded-full
                            ${run.status === 'running' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {run.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(run.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-medium">
                    {m.overall?.success_rate !== undefined ? (
                      <span className={m.overall.success_rate >= 0.8 ? 'text-green-600' : 'text-yellow-600'}>
                        {fmt(m.overall.success_rate, true)}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-600">
                    {fmt(m.retrieval?.context_precision, true)}
                  </td>

                  <td className="px-2 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-600">
                    {fmt(m.generation?.answer_relevance, true)}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-600">
                    {fmt(m.generation?.faithfulness, true)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-500">
                    {m.overall?.avg_total_latency_ms ? `${Math.round(m.overall.avg_total_latency_ms)}ms` : '-'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => onSelectRun(run)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Details
                    </button>
                    {onDeleteRun && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteRun(run); }}
                        className="text-red-600 hover:text-red-900"
                      >
                        Del
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
