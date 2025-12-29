import { useState, useMemo } from 'react';
import { MagnifyingGlassIcon, ChatBubbleLeftRightIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import ConversationDetail from './ConversationDetail';

interface Conversation {
  id: string;
  end_user_name: string;
  end_user_email: string;
  message_count: number;
  status: string;
  created_at: string;
}

interface ConversationsListProps {
  conversations: Conversation[];
}

type StatusFilter = 'all' | 'active' | 'closed';

const ConversationsList: React.FC<ConversationsListProps> = ({ conversations }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showDetail, setShowDetail] = useState<boolean>(false);

  // Filter and search conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      // Status filter
      if (statusFilter !== 'all' && conv.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          conv.end_user_name.toLowerCase().includes(query) ||
          conv.end_user_email.toLowerCase().includes(query) ||
          conv.id.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [conversations, searchQuery, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: conversations.length,
      active: conversations.filter(c => c.status === 'active').length,
      closed: conversations.filter(c => c.status === 'closed').length,
      avgMessages: conversations.length > 0
        ? Math.round(conversations.reduce((sum, c) => sum + c.message_count, 0) / conversations.length)
        : 0,
    };
  }, [conversations]);

  const handleConversationClick = (conversation: Conversation): void => {
    setSelectedConversation(conversation);
    setShowDetail(true);
  };

  const handleCloseDetail = (): void => {
    setShowDetail(false);
    setSelectedConversation(null);
  };

  const getStatusBadgeColor = (status: string): string => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow">
        {/* Statistics Cards */}
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Closed</p>
              <p className="text-2xl font-bold text-gray-600">{stats.closed}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Avg Messages</p>
              <p className="text-2xl font-bold text-purple-600">{stats.avgMessages}</p>
            </div>
          </div>

          <h2 className="text-xl font-bold mb-4">Conversations</h2>

          {/* Search and Filter */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or ID..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Conversations List */}
        <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-12 text-center">
              <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-500">
                {searchQuery || statusFilter !== 'all'
                  ? 'No conversations found matching your filters'
                  : 'No conversations yet'}
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => handleConversationClick(conv)}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900 truncate">
                        {conv.end_user_name}
                      </p>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusBadgeColor(conv.status)}`}
                      >
                        {conv.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate mb-1">
                      {conv.end_user_email}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{conv.message_count} messages</span>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(conv.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConversationClick(conv);
                      }}
                      className="px-3 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Results count */}
        {filteredConversations.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600 text-center">
              Showing {filteredConversations.length} of {conversations.length} conversations
            </p>
          </div>
        )}
      </div>

      {/* Conversation Detail Modal */}
      {showDetail && selectedConversation && (
        <ConversationDetail
          conversation={selectedConversation}
          onClose={handleCloseDetail}
        />
      )}
    </>
  );
};

export default ConversationsList;
