import { useState, useRef } from 'react';
import { ArrowUpTrayIcon, DocumentIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface ProgressEvent {
  loaded: number;
  total: number;
}

interface FileUploadDropZoneProps {
  kbId: string;
  onUploadSuccess: (formData: FormData, onProgress: (progressEvent: ProgressEvent) => void) => Promise<void>;
  onUploadError: (error: string) => void;
  acceptedFormats?: string[];
  maxSizeMB?: number;
}

const FileUploadDropZone: React.FC<FileUploadDropZoneProps> = ({
  kbId: _kbId,
  onUploadSuccess,
  onUploadError,
  acceptedFormats = ['.pdf', '.txt', '.md', '.csv', '.png', '.jpg', '.jpeg', '.webp', '.svg'],
  maxSizeMB = 100,
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    // Check file size
    if (file.size > maxSizeBytes) {
      return `File size exceeds ${maxSizeMB}MB limit`;
    }

    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedFormats.includes(fileExtension)) {
      return `File type not supported. Accepted formats: ${acceptedFormats.join(', ')}`;
    }

    return null;
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handleFileSelection = (file: File): void => {
    const error = validateFile(file);
    if (error) {
      onUploadError(error);
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async (): Promise<void> => {
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('provider', 'openai');

      await onUploadSuccess(formData, (progressEvent: ProgressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        setUploadProgress(percentCompleted);
      });

      // Reset after successful upload
      setSelectedFile(null);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: unknown) {
      const errorMsg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Upload failed';
      onUploadError(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = (): void => {
    setSelectedFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400'
          }
          ${isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
        `}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={acceptedFormats.join(',')}
          onChange={handleFileInputChange}
          disabled={isUploading}
        />

        <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">
          <span className="font-medium text-primary-600">Click to upload</span> or drag and drop
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {acceptedFormats.join(', ').toUpperCase()} up to {maxSizeMB}MB
        </p>
      </div>

      {/* Selected File Preview */}
      {selectedFile && !isUploading && (
        <div className="border border-gray-300 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <DocumentIcon className="h-8 w-8 text-primary-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 flex space-x-3">
            <button
              onClick={handleUpload}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Upload File
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && selectedFile && (
        <div className="border border-gray-300 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-3">
            <DocumentIcon className="h-8 w-8 text-primary-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">
                {uploadProgress < 100 ? 'Uploading...' : 'Processing and generating embeddings...'}
              </p>
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>

          <p className="mt-2 text-xs text-gray-600 text-center">
            {uploadProgress}% complete
          </p>
        </div>
      )}
    </div>
  );
};

export default FileUploadDropZone;
