import { useState, useEffect } from 'react';
import { XMarkIcon, UserIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { chatAPI } from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface Conversation {
  id: string;
  end_user_name: string;
  end_user_email: string;
  message_count: number;
  status: string;
  created_at: string;
}

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  created_at: string;
}

interface ConversationDetailProps {
  conversation: Conversation;
  onClose: () => void;
}

const ConversationDetail: React.FC<ConversationDetailProps> = ({ conversation, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  const loadMessages = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await chatAPI.getMessages(conversation.id);
      setMessages(response.data.messages);
    } catch {
      toast.error('Failed to load conversation messages');
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const exportConversation = (): void => {
    const conversationText = messages
      .map((msg) => {
        const timestamp = format(new Date(msg.created_at), 'PPpp');
        const sender = msg.sender === 'user' ? conversation.end_user_name : 'AI Assistant';
        return `[${timestamp}] ${sender}:\n${msg.content}\n`;
      })
      .join('\n');

    const blob = new Blob([conversationText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${conversation.id}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Conversation exported');
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Conversation with {conversation.end_user_name}
            </h2>
            <p className="text-sm text-gray-600 mt-1">{conversation.end_user_email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Close"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Conversation Info */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-gray-600">Status: </span>
              <span className={`font-medium ${conversation.status === 'active' ? 'text-green-600' : 'text-gray-600'}`}>
                {conversation.status}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Messages: </span>
              <span className="font-medium text-gray-900">{conversation.message_count}</span>
            </div>
            <div>
              <span className="text-gray-600">Started: </span>
              <span className="font-medium text-gray-900">
                {format(new Date(conversation.created_at), 'PPpp')}
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-gray-500 py-12">No messages in this conversation</p>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.sender === 'assistant' ? 'flex-row' : 'flex-row-reverse'}`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.sender === 'assistant'
                        ? 'bg-primary-100 text-primary-600'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {message.sender === 'assistant' ? (
                      <SparklesIcon className="h-5 w-5" />
                    ) : (
                      <UserIcon className="h-5 w-5" />
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`flex-1 max-w-[80%] ${
                      message.sender === 'assistant' ? 'mr-auto' : 'ml-auto'
                    }`}
                  >
                    <div
                      className={`rounded-lg p-4 ${
                        message.sender === 'assistant'
                          ? 'bg-gray-100 text-gray-900'
                          : 'bg-primary-600 text-white'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 px-2">
                      {format(new Date(message.created_at), 'p')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-between">
          <button
            onClick={exportConversation}
            disabled={messages.length === 0}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export Transcript
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConversationDetail;
