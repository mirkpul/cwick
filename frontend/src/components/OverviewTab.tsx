import {
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  CloudArrowUpIcon,
  EnvelopeIcon,
  ChartBarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

interface Conversation {
  id: string;
  end_user_name: string;
  end_user_email: string;
  message_count: number;
  status: string;
  created_at: string;
}

interface SyncStats {
  totalEmails?: number;
  lastSyncAt?: string;
  lastSyncStatus?: string;
}

interface EmailSyncStatusData {
  connected: boolean;
  provider?: string;
  emailAddress?: string;
  syncStats?: SyncStats;
}

interface OverviewTabProps {
  userName: string;
  kbName: string;
  chatUrl: string;
  conversations: Conversation[];
  knowledgeBaseCount: number;
  uploadedFilesCount: number;
  emailSyncStatus: EmailSyncStatusData | null;
  onCopyChatUrl: () => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  userName,
  kbName,
  chatUrl,
  conversations,
  knowledgeBaseCount,
  uploadedFilesCount,
  emailSyncStatus,
  onCopyChatUrl,
}) => {
  // Calculate statistics
  const totalConversations = conversations.length;
  const activeConversations = conversations.filter(c => c.status === 'active').length;
  const totalMessages = conversations.reduce((sum, c) => sum + c.message_count, 0);
  const avgMessagesPerConversation = totalConversations > 0 ? (totalMessages / totalConversations).toFixed(1) : '0';

  const recentConversations = conversations
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const totalEmailsImported = emailSyncStatus?.syncStats?.totalEmails || 0;
  const lastEmailSync = emailSyncStatus?.syncStats?.lastSyncAt;

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">Welcome back, {userName}!</h2>
        <p className="text-primary-100 mb-4">
          Your knowledge base <span className="font-semibold">{kbName}</span> is active and ready to engage with visitors.
        </p>

        <div className="bg-white bg-opacity-20 backdrop-blur-sm border border-white border-opacity-30 rounded-lg p-4">
          <p className="text-sm font-medium text-primary-50 mb-2">Your Chat Widget URL:</p>
          <div className="flex space-x-2">
            <input
              type="text"
              value={chatUrl}
              readOnly
              className="flex-1 px-3 py-2 bg-white bg-opacity-90 border border-transparent rounded text-sm text-gray-900"
            />
            <button
              onClick={onCopyChatUrl}
              className="px-4 py-2 bg-white text-primary-700 rounded hover:bg-primary-50 font-medium transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Conversations</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{totalConversations}</p>
              <p className="text-xs text-green-600 mt-1">{activeConversations} active</p>
            </div>
            <ChatBubbleLeftRightIcon className="h-12 w-12 text-blue-500 opacity-80" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Messages</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{totalMessages}</p>
              <p className="text-xs text-gray-500 mt-1">Avg: {avgMessagesPerConversation} per conv</p>
            </div>
            <ChartBarIcon className="h-12 w-12 text-purple-500 opacity-80" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Uploaded Files</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{uploadedFilesCount}</p>
              <p className="text-xs text-gray-500 mt-1">{knowledgeBaseCount} manual entries</p>
            </div>
            <CloudArrowUpIcon className="h-12 w-12 text-green-500 opacity-80" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Emails Imported</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{totalEmailsImported}</p>
              {lastEmailSync ? (
                <p className="text-xs text-gray-500 mt-1">
                  {formatDistanceToNow(new Date(lastEmailSync), { addSuffix: true })}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Not connected</p>
              )}
            </div>
            <EnvelopeIcon className="h-12 w-12 text-orange-500 opacity-80" />
          </div>
        </div>
      </div>

      {/* Recent Activity & Quick Stats */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Conversations */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <ClockIcon className="h-5 w-5 mr-2 text-gray-600" />
              Recent Conversations
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {recentConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <ChatBubbleLeftRightIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>No conversations yet</p>
              </div>
            ) : (
              recentConversations.map((conv) => (
                <div key={conv.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{conv.end_user_name}</p>
                      <p className="text-sm text-gray-500 truncate">{conv.end_user_email}</p>
                    </div>
                    <div className="ml-4 text-right flex-shrink-0">
                      <p className="text-xs font-medium text-gray-900">{conv.message_count} msgs</p>
                      <p className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(conv.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Knowledge Base Summary */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <DocumentTextIcon className="h-5 w-5 mr-2 text-gray-600" />
              Knowledge Base Summary
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-blue-900">Manual Entries</p>
                <p className="text-2xl font-bold text-blue-600">{knowledgeBaseCount}</p>
              </div>
              <DocumentTextIcon className="h-10 w-10 text-blue-400" />
            </div>

            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-green-900">Uploaded Files</p>
                <p className="text-2xl font-bold text-green-600">{uploadedFilesCount}</p>
              </div>
              <CloudArrowUpIcon className="h-10 w-10 text-green-400" />
            </div>

            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-orange-900">Email Messages</p>
                <p className="text-2xl font-bold text-orange-600">{totalEmailsImported}</p>
                {emailSyncStatus?.connected && (
                  <p className="text-xs text-orange-700 mt-1">
                    via {emailSyncStatus.provider}
                  </p>
                )}
              </div>
              <EnvelopeIcon className="h-10 w-10 text-orange-400" />
            </div>

            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">
                  {knowledgeBaseCount + uploadedFilesCount + totalEmailsImported}
                </span>{' '}
                total knowledge sources available
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Helpful Tips */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>Pro Tip:</strong> Regularly update your knowledge base with new content, adjust RAG settings
              for optimal performance, and review conversation analytics to improve response quality.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
