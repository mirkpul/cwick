import { useState } from 'react';
import { XMarkIcon, EyeIcon } from '@heroicons/react/24/outline';
import { knowledgeBaseAPI } from '../services/api';
import toast from 'react-hot-toast';

interface ContextPreviewProps {
  kbId: string;
}

interface ContextData {
  systemPrompt: string;
  knowledgeSummary: {
    totalEntries: number;
    categories: string[];
  };
}

const ContextPreview: React.FC<ContextPreviewProps> = ({ kbId }) => {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [contextData, setContextData] = useState<ContextData | null>(null);

  const loadContextPreview = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await knowledgeBaseAPI.previewContext(kbId);
      setContextData(response.data);
      setShowModal(true);
    } catch {
      toast.error('Failed to load context preview');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (): void => {
    setShowModal(false);
    setContextData(null);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <>
      <button
        onClick={loadContextPreview}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
      >
        <EyeIcon className="h-5 w-5" />
        {loading ? 'Loading...' : 'Preview Full Context'}
      </button>

      {showModal && contextData && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={handleBackdropClick}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                AI Context Preview
              </h2>
              <button
                onClick={handleClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Close"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* System Prompt Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  System Prompt
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                    {contextData.systemPrompt}
                  </pre>
                </div>
              </div>

              {/* Knowledge Summary Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Knowledge Base Summary
                </h3>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        Total Entries:
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        {contextData.knowledgeSummary.totalEntries}
                      </span>
                    </div>
                    {contextData.knowledgeSummary.categories.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700 block mb-2">
                          Categories:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {contextData.knowledgeSummary.categories.map((category, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"
                            >
                              {category}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      This is what the AI sees when responding to users. The system prompt provides
                      instructions and personality, while knowledge base entries are retrieved
                      semantically based on user queries.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ContextPreview;
