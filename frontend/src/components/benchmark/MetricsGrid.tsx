import MetricCard from './MetricCard';

interface Metrics {
  retrieval?: {
    context_precision?: number;
    context_recall?: number;
    mrr?: number;
    ndcg?: number;
    hit_rate?: number;
    avg_latency_ms?: number;
  };
  generation?: {
    faithfulness?: number;
    answer_relevance?: number;
    semantic_similarity?: number;
    avg_latency_ms?: number;
  };
  overall?: {
    success_rate?: number;
    total_questions?: number;
    successful?: number;
    avg_total_latency_ms?: number;
  };
}

interface Comparison {
  [key: string]: {
    pct_change?: number;
  };
}

interface MetricsGridProps {
  metrics: Metrics | null;
  comparison?: Comparison | null;
}

/**
 * MetricsGrid - Displays a grid of metrics from a benchmark run
 */
export default function MetricsGrid({ metrics, comparison = null }: MetricsGridProps): React.JSX.Element | null {
  if (!metrics) return null;

  const { retrieval, generation, overall } = metrics;

  const getChange = (path: string): number | null => {
    if (!comparison) return null;
    const comp = comparison[path];
    return comp?.pct_change || null;
  };

  const getColor = (value: number | undefined, thresholds = { good: 0.8, medium: 0.6 }): 'green' | 'yellow' | 'red' | 'gray' => {
    if (value === undefined || value === null) return 'gray';
    if (value >= thresholds.good) return 'green';
    if (value >= thresholds.medium) return 'yellow';
    return 'red';
  };

  return (
    <div className="space-y-6">
      {/* Retrieval Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Retrieval Metrics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard
            title="Precision"
            value={retrieval?.context_precision}
            color={getColor(retrieval?.context_precision)}
            change={getChange('retrieval.context_precision')}
            description="Relevant / Retrieved"
          />
          <MetricCard
            title="Recall"
            value={retrieval?.context_recall}
            color={getColor(retrieval?.context_recall)}
            change={getChange('retrieval.context_recall')}
            description="Retrieved / Expected"
          />
          <MetricCard
            title="MRR"
            value={retrieval?.mrr}
            color={getColor(retrieval?.mrr)}
            change={getChange('retrieval.mrr')}
            description="Mean Reciprocal Rank"
          />
          <MetricCard
            title="NDCG"
            value={retrieval?.ndcg}
            color={getColor(retrieval?.ndcg)}
            change={getChange('retrieval.ndcg')}
            description="Ranking Quality"
          />
          <MetricCard
            title="Hit Rate"
            value={retrieval?.hit_rate}
            color={getColor(retrieval?.hit_rate)}
            change={getChange('retrieval.hit_rate')}
            description="Queries with hits"
          />
          <MetricCard
            title="Latency"
            value={retrieval?.avg_latency_ms}
            format="ms"
            color={(retrieval?.avg_latency_ms ?? 0) < 200 ? 'green' : (retrieval?.avg_latency_ms ?? 0) < 500 ? 'yellow' : 'red'}
            change={getChange('retrieval.avg_latency_ms')}
            description="Avg search time"
          />
        </div>
      </div>

      {/* Generation Metrics */}
      {generation && ((generation.faithfulness ?? 0) > 0 || (generation.answer_relevance ?? 0) > 0) && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Generation Metrics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <MetricCard
              title="Faithfulness"
              value={generation?.faithfulness}
              color={getColor(generation?.faithfulness)}
              change={getChange('generation.faithfulness')}
              description="Grounded in context"
            />
            <MetricCard
              title="Relevance"
              value={generation?.answer_relevance}
              color={getColor(generation?.answer_relevance)}
              change={getChange('generation.answer_relevance')}
              description="Addresses question"
            />
            <MetricCard
              title="Similarity"
              value={generation?.semantic_similarity}
              color={getColor(generation?.semantic_similarity, { good: 0.7, medium: 0.5 })}
              change={getChange('generation.semantic_similarity')}
              description="To expected answer"
            />
            <MetricCard
              title="Gen Latency"
              value={generation?.avg_latency_ms}
              format="ms"
              color={(generation?.avg_latency_ms ?? 0) < 2000 ? 'green' : (generation?.avg_latency_ms ?? 0) < 5000 ? 'yellow' : 'red'}
              change={getChange('generation.avg_latency_ms')}
              description="Avg generation time"
            />
          </div>
        </div>
      )}

      {/* Overall Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Overall
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            title="Success Rate"
            value={overall?.success_rate}
            color={getColor(overall?.success_rate, { good: 0.95, medium: 0.8 })}
            change={getChange('overall.success_rate')}
            size="default"
          />
          <MetricCard
            title="Questions"
            value={overall?.total_questions}
            format="number"
            color="gray"
            size="default"
          />
          <MetricCard
            title="Successful"
            value={overall?.successful}
            format="number"
            color="green"
            size="default"
          />
          <MetricCard
            title="Total Latency"
            value={overall?.avg_total_latency_ms}
            format="ms"
            color={(overall?.avg_total_latency_ms ?? 0) < 3000 ? 'green' : (overall?.avg_total_latency_ms ?? 0) < 6000 ? 'yellow' : 'red'}
            change={getChange('overall.avg_total_latency_ms')}
            size="default"
          />
        </div>
      </div>
    </div>
  );
}
