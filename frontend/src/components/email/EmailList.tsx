import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, TrashIcon, EnvelopeIcon, EnvelopeOpenIcon } from '@heroicons/react/24/outline';
import { emailAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import EmailPreview from './EmailPreview';

interface Email {
  id: string;
  sender: string;
  subject?: string;
  snippet?: string;
  textContent?: string;
  htmlContent?: string;
  receivedAt: string;
  isRead?: boolean;
  recipient?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const EmailList: React.FC = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    loadEmails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, searchQuery]);

  const loadEmails = async (): Promise<void> => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery || undefined
      };

      const response = await emailAPI.listEmails(params);
      const { emails: emailData, pagination: paginationData } = response.data;

      setEmails(emailData);
      setPagination({
        ...pagination,
        total: paginationData.total,
        totalPages: paginationData.totalPages
      });
    } catch {
      toast.error('Failed to load emails');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setPagination({ ...pagination, page: 1 });
    loadEmails();
  };

  const handleDeleteEmail = async (emailId: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this email from your knowledge base?')) {
      return;
    }

    try {
      await emailAPI.deleteEmail(emailId);
      toast.success('Email deleted');
      setEmails(emails.filter(email => email.id !== emailId));
      setPagination({
        ...pagination,
        total: pagination.total - 1
      });
    } catch {
      toast.error('Failed to delete email');
    }
  };

  const handleEmailClick = (email: Email): void => {
    setSelectedEmail(email);
    setShowPreview(true);
  };

  const handleClosePreview = (): void => {
    setShowPreview(false);
    setSelectedEmail(null);
  };

  const truncateText = (text: string | undefined, maxLength = 100): string => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  if (loading && emails.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow">
        {/* Header with Search */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Imported Emails</h2>
            <p className="text-sm text-gray-600">
              {pagination.total} email{pagination.total !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by sender, subject, or content..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        {/* Email List */}
        <div className="divide-y divide-gray-200">
          {emails.length === 0 ? (
            <div className="p-12 text-center">
              <EnvelopeIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-500">
                {searchQuery ? 'No emails found matching your search' : 'No emails imported yet'}
              </p>
            </div>
          ) : (
            emails.map((email) => (
              <div
                key={email.id}
                onClick={() => handleEmailClick(email)}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Email Icon */}
                  <div className="flex-shrink-0 pt-1">
                    {email.isRead ? (
                      <EnvelopeOpenIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EnvelopeIcon className="h-5 w-5 text-primary-600" />
                    )}
                  </div>

                  {/* Email Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className={`text-sm font-medium truncate ${email.isRead ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}>
                        {email.sender}
                      </p>
                      <p className="text-xs text-gray-500 flex-shrink-0">
                        {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                      </p>
                    </div>
                    <p className={`text-sm mb-1 truncate ${email.isRead ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                      {email.subject || '(No Subject)'}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {truncateText(email.snippet || email.textContent, 150)}
                    </p>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDeleteEmail(email.id, e)}
                    className="flex-shrink-0 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete email"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <span className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Email Preview Modal */}
      {showPreview && selectedEmail && (
        <EmailPreview
          email={selectedEmail}
          onClose={handleClosePreview}
        />
      )}
    </>
  );
};

export default EmailList;
