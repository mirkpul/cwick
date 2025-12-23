import { useState } from 'react';

export interface Question {
  id: string;
  question: string;
  expected_answer?: string;
  question_type: string;
  difficulty: string;
  source_type?: string;
  expected_context_ids?: string[];
  tags?: string[];
}

export interface QuestionsListProps {
  questions: Question[] | null;
  onDelete?: (question: Question) => void;
  onEdit?: (question: Question) => void;
  loading?: boolean;
}

/**
 * QuestionsList - Displays and manages questions in a dataset
 */
export default function QuestionsList({
  questions,
  onDelete,
  onEdit,
  loading = false
}: QuestionsListProps): React.JSX.Element {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading questions...
      </div>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No questions in this dataset yet.
      </div>
    );
  }

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'simple':
        return 'bg-green-100 text-green-700';
      case 'complex':
        return 'bg-blue-100 text-blue-700';
      case 'multi_hop':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getDifficultyColor = (diff: string): string => {
    switch (diff) {
      case 'easy':
        return 'bg-green-50 text-green-600';
      case 'medium':
        return 'bg-yellow-50 text-yellow-600';
      case 'hard':
        return 'bg-red-50 text-red-600';
      default:
        return 'bg-gray-50 text-gray-600';
    }
  };

  return (
    <div className="space-y-2">
      {questions.map((q: Question, index: number) => (
        <div
          key={q.id}
          className="border border-gray-200 rounded-lg overflow-hidden"
        >
          <div
            className="p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
          >
            <div className="flex items-start gap-3">
              <span className="text-xs text-gray-400 font-mono mt-1">
                #{index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 line-clamp-2">
                  {q.question}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(q.question_type)}`}>
                    {q.question_type}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${getDifficultyColor(q.difficulty)}`}>
                    {q.difficulty}
                  </span>
                  {q.source_type === 'synthetic' && (
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-600">
                      synthetic
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(q);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete this question?')) {
                        onDelete(q);
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${expandedId === q.id ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {expandedId === q.id && (
            <div className="p-4 bg-white border-t border-gray-100 space-y-3">
              {q.expected_answer && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">
                    Expected Answer
                  </label>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                    {q.expected_answer}
                  </p>
                </div>
              )}
              {q.expected_context_ids && q.expected_context_ids.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">
                    Expected Context IDs
                  </label>
                  <p className="text-xs text-gray-500 mt-1 font-mono">
                    {q.expected_context_ids.join(', ')}
                  </p>
                </div>
              )}
              {q.tags && q.tags.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {q.tags.map((tag: string, i: number) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
