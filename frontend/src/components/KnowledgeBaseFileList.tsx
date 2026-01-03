import { useState } from 'react';
import { DocumentIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { knowledgeBaseAPI } from '../services/api';
import { UploadedFile } from '../types';

interface KnowledgeBaseFileListProps {
  kbId: string;
  files: UploadedFile[];
  onFileDeleted: (fileId: string) => void;
}

const KnowledgeBaseFileList: React.FC<KnowledgeBaseFileListProps> = ({ kbId, files, onFileDeleted }) => {
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileTypeLabel = (mimeType: string): string => {
    const typeMap: Record<string, string> = {
      'application/pdf': 'PDF',
      'text/plain': 'TXT',
      'text/markdown': 'Markdown',
      'text/csv': 'CSV'
    };
    return typeMap[mimeType] || 'File';
  };

  const getFileTypeColor = (mimeType: string): string => {
    const colorMap: Record<string, string> = {
      'application/pdf': 'bg-red-100 text-red-800',
      'text/plain': 'bg-blue-100 text-blue-800',
      'text/markdown': 'bg-purple-100 text-purple-800',
      'text/csv': 'bg-green-100 text-green-800'
    };
    return colorMap[mimeType] || 'bg-gray-100 text-gray-800';
  };

  const handleDelete = async (fileId: string, fileName: string): Promise<void> => {
    if (!confirm(`Are you sure you want to delete "${fileName}" and all its chunks?`)) {
      return;
    }

    setDeletingFileId(fileId);
    try {
      await knowledgeBaseAPI.deleteKnowledgeFile(kbId, fileId);
      toast.success('File deleted successfully');
      onFileDeleted(fileId);
    } catch (error: unknown) {
      const errorMsg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to delete file';
      toast.error(errorMsg);
    } finally {
      setDeletingFileId(null);
    }
  };

  if (!files || files.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
        <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">No files uploaded yet</p>
        <p className="text-xs text-gray-500">Upload a document to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700">
          Uploaded Files ({files.length})
        </h3>
      </div>

      <div className="grid gap-3">
        {files.map((file) => (
          <div
            key={file.id}
            className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors bg-white"
          >
            <div className="flex items-start justify-between">
              {/* File Info */}
              <div className="flex items-start space-x-3 flex-1 min-w-0">
                <DocumentIcon className="h-10 w-10 text-primary-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.file_name}
                    </p>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${getFileTypeColor(file.file_type)}`}>
                      {getFileTypeLabel(file.file_type)}
                    </span>
                  </div>

                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>{formatFileSize(file.file_size)}</span>
                    <span>•</span>
                    <span>{file.total_chunks} {file.total_chunks === 1 ? 'chunk' : 'chunks'}</span>
                    <span>•</span>
                    <span>{formatDate(file.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* Delete Button */}
              <button
                onClick={() => handleDelete(file.id, file.file_name)}
                disabled={deletingFileId === file.id}
                className="ml-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete file"
              >
                {deletingFileId === file.id ? (
                  <div className="animate-spin h-5 w-5 border-2 border-red-600 border-t-transparent rounded-full" />
                ) : (
                  <TrashIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KnowledgeBaseFileList;
