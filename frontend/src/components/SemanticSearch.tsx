import { useState } from 'react';
import { MagnifyingGlassIcon, SparklesIcon, EnvelopeIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { knowledgeBaseAPI } from '../services/api';
import { format } from 'date-fns';
import RAGConfigPanel from './RAGConfigPanel';
import { RAGConfig, SearchResult as BaseSearchResult } from '../types/rag';

interface SearchResult extends BaseSearchResult {
  subject?: string;
  content_type?: string;
  file_name?: string;
  chunk_index?: number;
  total_chunks?: number;
}

interface SemanticSearchProps {
  kbId: string;
}

interface ResultsBoxProps {
  title: string;
  icon: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement>>;
  results: SearchResult[];
  type: string;
}

const SemanticSearch: React.FC<SemanticSearchProps> = ({ kbId }) => {
  const [query, setQuery] = useState<string>('');
  const [knowledgeResults, setKnowledgeResults] = useState<SearchResult[]>([]);
  const [emailResults, setEmailResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [_ragConfig, setRagConfig] = useState<RAGConfig | null>(null);

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!query.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const response = await knowledgeBaseAPI.searchKnowledge(kbId, query.trim(), 10);
      setKnowledgeResults(response.data.knowledge || []);
      setEmailResults(response.data.emails || []);

      if ((response.data.knowledge?.length || 0) === 0 && (response.data.emails?.length || 0) === 0) {
        toast('No results found', { icon: '🔍' });
      }
    } catch (error: unknown) {
      const errorMsg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Search failed';
      toast.error(errorMsg);
      setKnowledgeResults([]);
      setEmailResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const highlightText = (text: string, maxLength = 200): string => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const getSimilarityColor = (similarity: number): string => {
    if (similarity >= 0.9) return 'text-green-600';
    if (similarity >= 0.7) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getSimilarityLabel = (similarity: number): string => {
    if (similarity >= 0.9) return 'Excellent match';
    if (similarity >= 0.7) return 'Good match';
    return 'Fair match';
  };

  const ResultsBox: React.FC<ResultsBoxProps> = ({ title, icon: Icon, results, type }) => {
    if (!hasSearched || isSearching) return null;

    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Icon className="h-5 w-5 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
              <span className="text-xs text-gray-500">({results.length} results)</span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="divide-y divide-gray-200">
          {results.length === 0 ? (
            <div className="text-center py-8 bg-gray-50">
              <p className="text-sm text-gray-500">No results found in {title.toLowerCase()}</p>
            </div>
          ) : (
            results.map((result) => (
              <div key={result.id} className="p-4 hover:bg-gray-50 transition-colors">
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">
                      {result.title || result.subject || 'Untitled'}
                    </h4>
                    {type === 'email' && result.senderName && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        From: {result.senderName} ({result.senderEmail})
                      </p>
                    )}
                    {type === 'knowledge' && result.file_name && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        From: {result.file_name}
                        {result.chunk_index !== undefined && result.total_chunks && result.total_chunks > 1 && (
                          <span> (Part {result.chunk_index + 1} of {result.total_chunks})</span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Similarity Score */}
                  <div className="ml-4 text-right flex-shrink-0">
                    <div className={`text-sm font-semibold ${getSimilarityColor(result.similarity ?? 0)}`}>
                      {Math.round((result.similarity ?? 0) * 100)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {getSimilarityLabel(result.similarity ?? 0)}
                    </div>
                  </div>
                </div>

                {/* Content Preview */}
                <p className="text-sm text-gray-700 leading-relaxed mb-2">
                  {highlightText(result.content ?? '', 300)}
                </p>

                {/* Metadata */}
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span className="capitalize">{result.content_type || type}</span>
                  {result.sentAt && (
                    <>
                      <span>•</span>
                      <span>{format(new Date(result.sentAt), 'PPp')}</span>
                    </>
                  )}
                  {result.created_at && !result.sentAt && (
                    <>
                      <span>•</span>
                      <span>{new Date(result.created_at).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* RAG Configuration Panel */}
      <RAGConfigPanel kbId={kbId} onConfigChange={setRagConfig} />

      {/* Search Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <form onSubmit={handleSearch} className="space-y-3">
          <div>
            <label className="block text-lg font-semibold text-gray-900 mb-3">
              <SparklesIcon className="inline-block h-5 w-5 mr-2 text-primary-600" />
              Semantic Search
            </label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by meaning across all your knowledge and emails..."
                  className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
                  disabled={isSearching}
                />
                <MagnifyingGlassIcon className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
              </div>
              <button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="px-8 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap font-medium"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>

            <p className="mt-3 text-sm text-gray-500">
              AI-powered hybrid search (vector + keyword matching) finds relevant content based on meaning and context from both your knowledge base and emails
            </p>
          </div>
        </form>
      </div>

      {/* Loading State */}
      {isSearching && (
        <div className="text-center py-12">
          <div className="animate-spin mx-auto h-10 w-10 border-4 border-primary-600 border-t-transparent rounded-full" />
          <p className="mt-4 text-base text-gray-600">Searching across knowledge base and emails...</p>
        </div>
      )}

      {/* Search Results - Two Boxes */}
      {hasSearched && !isSearching && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Knowledge Base Results */}
          <ResultsBox
            title="Knowledge Base"
            icon={BookOpenIcon}
            results={knowledgeResults}
            type="knowledge"
          />

          {/* Email Results */}
          <ResultsBox
            title="Emails"
            icon={EnvelopeIcon}
            results={emailResults}
            type="email"
          />
        </div>
      )}

      {/* No Results State */}
      {hasSearched && !isSearching && knowledgeResults.length === 0 && emailResults.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <MagnifyingGlassIcon className="mx-auto h-16 w-16 text-gray-400" />
          <p className="mt-4 text-base font-medium text-gray-900">No results found</p>
          <p className="text-sm text-gray-500 mt-1">Try different keywords or upload more documents and emails</p>
        </div>
      )}
    </div>
  );
};

export default SemanticSearch;
