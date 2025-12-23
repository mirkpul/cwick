import { XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import { emailAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface Email {
  id: string;
  subject?: string;
  sender: string;
  recipient?: string;
  receivedAt: string;
  htmlContent?: string;
  textContent?: string;
}

interface EmailPreviewProps {
  email: Email;
  onClose: () => void;
  onDelete?: (emailId: string) => void;
}

const EmailPreview: React.FC<EmailPreviewProps> = ({ email, onClose, onDelete }) => {
  const handleDelete = async (): Promise<void> => {
    if (!confirm('Are you sure you want to delete this email from your knowledge base?')) {
      return;
    }

    try {
      await emailAPI.deleteEmail(email.id);
      toast.success('Email deleted');
      if (onDelete) {
        onDelete(email.id);
      }
      onClose();
    } catch {
      toast.error('Failed to delete email');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 truncate pr-4">
            {email.subject || '(No Subject)'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete email"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Close"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Email Metadata */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-sm font-medium text-gray-500 w-20 flex-shrink-0">From:</span>
              <span className="text-sm text-gray-900">{email.sender}</span>
            </div>
            {email.recipient && (
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium text-gray-500 w-20 flex-shrink-0">To:</span>
                <span className="text-sm text-gray-900">{email.recipient}</span>
              </div>
            )}
            <div className="flex items-start gap-2">
              <span className="text-sm font-medium text-gray-500 w-20 flex-shrink-0">Date:</span>
              <span className="text-sm text-gray-900">
                {format(new Date(email.receivedAt), 'PPpp')}
              </span>
            </div>
          </div>
        </div>

        {/* Email Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {email.htmlContent ? (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: email.htmlContent }}
            />
          ) : (
            <div className="whitespace-pre-wrap text-sm text-gray-900">
              {email.textContent || '(No content)'}
            </div>
          )}
        </div>

        {/* Footer with close button */}
        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailPreview;
