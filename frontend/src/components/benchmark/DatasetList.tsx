export interface Dataset {
  id: string;
  name: string;
  dataset_type: string;
  description?: string;
  active_questions?: number;
  total_questions?: number;
  created_at: string;
}

export interface DatasetListProps {
  datasets: Dataset[] | null;
  selectedId?: string;
  onSelect?: (dataset: Dataset) => void;
  onDelete?: (dataset: Dataset) => void;
  onExport?: (dataset: Dataset) => void;
  loading?: boolean;
}

/**
 * DatasetList - Displays list of benchmark datasets
 */
export default function DatasetList({
  datasets,
  selectedId,
  onSelect,
  onDelete,
  onExport,
  loading = false
}: DatasetListProps): React.JSX.Element {
  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading datasets...
      </div>
    );
  }

  if (!datasets || datasets.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No datasets yet. Create one to get started.
      </div>
    );
  }

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'golden':
        return 'bg-yellow-100 text-yellow-800';
      case 'synthetic':
        return 'bg-purple-100 text-purple-800';
      case 'hybrid':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-2">
      {datasets.map((dataset) => (
        <div
          key={dataset.id}
          className={`p-4 rounded-lg border cursor-pointer transition-colors ${
            selectedId === dataset.id
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
          onClick={() => onSelect?.(dataset)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900">{dataset.name}</h4>
                <span className={`text-xs px-2 py-0.5 rounded-full ${getTypeColor(dataset.dataset_type)}`}>
                  {dataset.dataset_type}
                </span>
              </div>
              {dataset.description && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                  {dataset.description}
                </p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                <span>{dataset.active_questions || dataset.total_questions || 0} questions</span>
                <span>{new Date(dataset.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 ml-2">
              {onExport && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onExport(dataset);
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  title="Export dataset"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this dataset?')) {
                      onDelete(dataset);
                    }
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Delete dataset"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
