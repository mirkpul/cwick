import React, { useState } from 'react';
import { RunResult, BenchmarkRun, ResultMetrics, RetrievedContext } from '../../types/benchmark';

export interface RunDetailViewProps {
  run: BenchmarkRun | null;
  results: RunResult[];
  onBack: () => void;
}

/**
 * RunDetailView - Detailed view of a single benchmark run
 * Shows metrics summary and expandable list of Q&A pairs with retrieved context
 */
export default function RunDetailView({ run, results, onBack }: RunDetailViewProps): React.JSX.Element | null {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'failed' | 'low_score'>('all');

  if (!run) return null;

  const toggleRow = (id: string): void => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter results
  const filteredResults = results.filter((r: RunResult) => {
    if (filter === 'all') return true;
    const metrics: ResultMetrics = typeof r.metrics === 'string' ? JSON.parse(r.metrics) : r.metrics || {};
    if (filter === 'failed' && metrics.generation?.faithfulness === 0) return true;
    if (filter === 'low_score') {
      return (metrics.retrieval?.context_precision !== undefined && metrics.retrieval.context_precision < 0.5) ||
             (metrics.generation?.answer_relevance !== undefined && metrics.generation.answer_relevance < 0.5);
    }
    return false;
  });

  const fmt = (num: number | undefined | null): string => num ? num.toFixed(2) : '-';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition"
          >
            ← Back
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{run.name}</h2>
            <div className="text-sm text-gray-500">
              {new Date(run.created_at).toLocaleString()} • {run.dataset_name} • {results.length} Questions
            </div>
          </div>
        </div>

        {/* Quick Filter */}
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'failed' | 'low_score')}
            className="border-gray-300 rounded-md shadow-sm text-sm"
          >
            <option value="all">All Results</option>
            <option value="low_score">Low Scores (&lt; 0.5)</option>
          </select>
        </div>
      </div>

      {/* Logic / Configuration Snapshot (Collapsible?) */}
      {run.rag_config && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm">
          <h4 className="font-semibold text-gray-700 mb-2">RAG Configuration Snapshot</h4>
          <pre className="text-xs overflow-auto max-h-32 text-gray-600">
            {JSON.stringify(JSON.parse(typeof run.rag_config === 'string' ? run.rag_config : JSON.stringify(run.rag_config)), null, 2)}
          </pre>
        </div>
      )}

      {/* Main Q&A Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-4 py-3"></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Question</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Generated Answer</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Relevance</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Faithfulness</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Latency</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredResults.map((result: RunResult) => {
              const metrics: ResultMetrics = typeof result.metrics === 'string' ? JSON.parse(result.metrics) : result.metrics || {};
              const context: RetrievedContext[] = typeof result.retrieved_context === 'string' ? JSON.parse(result.retrieved_context) : result.retrieved_context || [];
              const isExpanded = expandedRows.has(result.id);

              return (
                <React.Fragment key={result.id}>
                  <tr className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`} onClick={() => toggleRow(result.id)}>
                    <td className="px-4 py-4 text-gray-400 text-center">
                      {isExpanded ? '▼' : '▶'}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">{result.original_question || result.input_question}</td>
                    <td className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate">{result.generated_answer || '-'}</td>
                    <td className="px-4 py-4 text-sm text-right font-mono">
                      <div className={(metrics.generation?.answer_relevance ?? 0) < 0.5 ? 'text-red-600' : 'text-green-600'}>
                        {fmt(metrics.generation?.answer_relevance)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-right font-mono">
                      <div className={(metrics.generation?.faithfulness ?? 0) < 0.5 ? 'text-red-600' : 'text-green-600'}>
                        {fmt(metrics.generation?.faithfulness)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-right text-gray-500">
                      {result.total_latency_ms}ms
                    </td>
                  </tr>
                  {/* Expanded Detail Row */}
                  {isExpanded && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-4 py-4 border-t border-gray-100">
                        <div className="grid grid-cols-2 gap-6">
                          {/* Left: QA Detail */}
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Full Question</h4>
                              <div className="p-3 bg-white rounded border border-gray-200 text-sm">
                                {result.original_question || result.input_question}
                              </div>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Expected Answer</h4>
                              <div className="p-3 bg-white rounded border border-green-100 text-sm text-green-800">
                                {result.expected_answer || 'N/A'}
                              </div>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Generated Answer</h4>
                              <div className="p-3 bg-white rounded border border-blue-100 text-sm text-blue-800">
                                {result.generated_answer}
                              </div>
                            </div>
                            {/* Reasoning Section */}
                            {(metrics.generation?.faithfulness_reasoning || metrics.generation?.answer_relevance_reasoning) && (
                              <div className="mt-4">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">LLM Evaluation Reasoning</h4>
                                <div className="space-y-2">
                                  {metrics.generation?.faithfulness_reasoning && (
                                    <div className="p-2 bg-gray-50 rounded border border-gray-100 text-xs">
                                      <span className="font-semibold text-gray-600 block mb-1">Faithfulness:</span>
                                      <span className="text-gray-600 italic">&quot;{metrics.generation.faithfulness_reasoning}&quot;</span>
                                    </div>
                                  )}
                                  {metrics.generation?.answer_relevance_reasoning && (
                                    <div className="p-2 bg-gray-50 rounded border border-gray-100 text-xs">
                                      <span className="font-semibold text-gray-600 block mb-1">Answer Relevance:</span>
                                      <span className="text-gray-600 italic">&quot;{metrics.generation.answer_relevance_reasoning}&quot;</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Right: Context */}
                          <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Retrieved Context ({context.length})</h4>
                            <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                              {context.map((ctx: RetrievedContext, idx: number) => {
                                // Use LLM-based relevance if available (is_relevant), fallback to ID check
                                let isRelevant = ctx.is_relevant;
                                if (isRelevant === undefined && result.expected_context_ids?.length && ctx.id) {
                                  isRelevant = result.expected_context_ids.includes(ctx.id);
                                }

                                return (
                                  <div key={idx} className={`p-3 bg-white rounded border text-sm ${isRelevant ? 'border-green-300 ring-1 ring-green-100' : 'border-gray-200'}`}>
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="font-semibold text-xs text-blue-600">
                                        Rank {idx + 1}
                                        {isRelevant && <span className="ml-2 text-green-600 font-bold">✓ RELEVANT (LLM)</span>}
                                      </span>
                                      <span className="text-xs text-gray-400">Score: {ctx.score?.toFixed(3) || '-'}</span>
                                    </div>
                                    <div className="text-gray-700">{ctx.content}</div>
                                    <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-xs text-gray-400">
                                      <span>ID: {ctx.id}</span>
                                      <span>Source: {ctx.metadata?.source || 'Unknown'}</span>
                                    </div>
                                    {ctx.relevance_reasoning && (
                                      <div className="mt-2 text-xs text-gray-500 italic border-l-2 border-gray-300 pl-2">
                                        &quot;{ctx.relevance_reasoning}&quot;
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                  }
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div >
  );
}
