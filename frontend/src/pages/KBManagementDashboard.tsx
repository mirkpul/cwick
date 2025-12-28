import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { knowledgeBaseAPI, chatAPI, emailAPI } from '../services/api';
import toast from 'react-hot-toast';
import { UploadedFile as UploadedFileType } from '../types';
import KnowledgeBaseSettings from '../components/KnowledgeBaseSettings';
import FileUploadDropZone from '../components/FileUploadDropZone';
import KnowledgeBaseFileList from '../components/KnowledgeBaseFileList';
import SemanticSearch from '../components/SemanticSearch';
import EmailConnectionCard from '../components/email/EmailConnectionCard';
import EmailSyncStatus from '../components/email/EmailSyncStatus';
import EmailList from '../components/email/EmailList';
import EmailSettings from '../components/email/EmailSettings';
import WebScrapingTab from '../components/web/WebScrapingTab';

interface DigitalTwin {
  id: string;
  name: string;
  profession?: string;
  bio?: string;
  llmProvider?: string;
  llmModel?: string;
  systemPrompt?: string;
}

interface Conversation {
  id: string;
  end_user_name: string;
  end_user_email: string;
  message_count: number;
  status: string;
  created_at: string;
}

interface Handover {
  id: string;
  end_user_name: string;
  reason?: string;
  is_read: boolean;
  is_accepted: boolean;
  created_at: string;
}

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
}


interface SyncStats {
  totalEmails?: number;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  lastSyncError?: string;
}

interface EmailSyncStatusData {
  connected: boolean;
  provider?: string;
  emailAddress?: string;
  autoSync?: boolean;
  syncStats?: SyncStats;
  lastSyncStatus?: string;
}

interface ApiError {
  response?: {
    status?: number;
  };
}

type TabType = 'overview' | 'conversations' | 'handovers' | 'search' | 'knowledge' | 'email' | 'settings';

const TAB_LABELS: Record<TabType, string> = {
  overview: 'Overview',
  conversations: 'Conversations',
  handovers: 'Handovers',
  search: 'Semantic Search',
  knowledge: 'Knowledge',
  email: 'Email',
  settings: 'Settings',
};

export default function KBManagementDashboard(): React.JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [twin, setTwin] = useState<DigitalTwin | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeEntry[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [newKnowledge, setNewKnowledge] = useState<{ title: string; content: string }>({ title: '', content: '' });
  const [emailConnected, setEmailConnected] = useState<boolean>(false);
  const [emailSyncStatus, setEmailSyncStatus] = useState<EmailSyncStatusData | null>(null);

  useEffect(() => {
    loadDashboardData();

    // Handle OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('email_connected') === 'true') {
      toast.success('Email account connected successfully!');
      // Clean URL
      window.history.replaceState({}, '', '/dashboard');
    } else if (params.get('email_error')) {
      toast.error(decodeURIComponent(params.get('email_error') || ''));
      window.history.replaceState({}, '', '/dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDashboardData = async (): Promise<void> => {
    try {
      const [twinRes, convsRes, handoversRes] = await Promise.all([
        knowledgeBaseAPI.getMyKB(),
        chatAPI.getMyConversations(),
        chatAPI.getHandovers(false),
      ]);

      const twinData = twinRes.data.twin;
      setTwin(twinData);
      setConversations(convsRes.data.conversations);
      setHandovers(handoversRes.data.notifications);

      if (twinData) {
        const [kbRes, filesRes, emailStatusRes] = await Promise.all([
          knowledgeBaseAPI.getKnowledge(twinData.id),
          knowledgeBaseAPI.listKnowledgeFiles(twinData.id),
          emailAPI.getSyncStatus().catch(() => ({ data: { connected: false } }))
        ]);
        setKnowledgeBase(kbRes.data.knowledge);
        const filesData = filesRes.data.files || [];
        setUploadedFiles(filesData as UploadedFileType[]);
        setEmailConnected(emailStatusRes.data.connected || false);
        setEmailSyncStatus(emailStatusRes.data as EmailSyncStatusData);
      }
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.response?.status === 404) {
        // No twin created yet
        navigate('/onboarding');
      } else {
        toast.error('Failed to load dashboard data');
      }
    }
    setLoading(false);
  };

  const addKnowledgeEntry = async (): Promise<void> => {
    if (!newKnowledge.title || !newKnowledge.content) {
      toast.error('Please fill in both title and content');
      return;
    }

    try {
      await knowledgeBaseAPI.addKnowledge(twin!.id, {
        question: newKnowledge.title,
        answer: newKnowledge.content,
        category: 'manual_entry',
      });

      toast.success('Knowledge entry added');
      setNewKnowledge({ title: '', content: '' });
      loadDashboardData();
    } catch {
      toast.error('Failed to add knowledge entry');
    }
  };

  const deleteKnowledgeEntry = async (entryId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
      await knowledgeBaseAPI.deleteKnowledge(twin!.id, entryId);
      toast.success('Knowledge entry deleted');
      loadDashboardData();
    } catch {
      toast.error('Failed to delete knowledge entry');
    }
  };

  const handleFileUploadSuccess = async (formData: FormData, onProgress: (progressEvent: { loaded: number; total: number }) => void): Promise<void> => {
    await knowledgeBaseAPI.uploadKnowledgeFile(twin!.id, formData, (progressEvent) => {
      const total = progressEvent.total || 100;
      const percentCompleted = Math.round((progressEvent.loaded * 100) / total);
      onProgress({ loaded: percentCompleted, total: 100 });
    });
    toast.success('File uploaded and processed successfully!');

    // Reload files list
    const filesRes = await knowledgeBaseAPI.listKnowledgeFiles(twin!.id);
    setUploadedFiles((filesRes.data.files || []) as UploadedFileType[]);
  };

  const handleFileDeleted = (fileId: string): void => {
    setUploadedFiles(uploadedFiles.filter(file => file.id !== fileId));
  };

  const getChatUrl = (): string => {
    return `${window.location.origin}/chat/${twin?.id}`;
  };

  const copyChatUrl = (): void => {
    navigator.clipboard.writeText(getChatUrl());
    toast.success('Chat URL copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <span className="text-xl font-bold text-primary-600">Digital Twin Dashboard</span>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">{user?.full_name}</span>
              <button
                onClick={logout}
                className="text-gray-700 hover:text-primary-600"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex space-x-8">
            {(['overview', 'conversations', 'handovers', 'search', 'knowledge', 'email', 'settings'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
            <button
              onClick={() => navigate('/benchmark')}
              className="py-4 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              RAG Benchmark
            </button>
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-4">Welcome, {user?.full_name}!</h2>
              <p className="text-gray-600 mb-4">
                Your digital twin <span className="font-semibold">{twin?.name}</span> is active and ready to engage with visitors.
              </p>

              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-primary-900 mb-2">Your Chat Widget URL:</p>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={getChatUrl()}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white border border-primary-300 rounded text-sm"
                  />
                  <button
                    onClick={copyChatUrl}
                    className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-gray-500 text-sm font-medium">Total Conversations</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">{conversations.length}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-gray-500 text-sm font-medium">Pending Handovers</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {handovers.filter(h => !h.is_read).length}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-gray-500 text-sm font-medium">Knowledge Entries</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">{knowledgeBase.length}</p>
              </div>
            </div>
          </div>
        )}

        {/* Conversations Tab */}
        {activeTab === 'conversations' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Recent Conversations</h2>
              {conversations.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No conversations yet</p>
              ) : (
                <div className="space-y-4">
                  {conversations.map((conv) => (
                    <div key={conv.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{conv.end_user_name}</p>
                          <p className="text-sm text-gray-600">{conv.end_user_email}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {conv.message_count} messages · {conv.status}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(conv.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Handovers Tab */}
        {activeTab === 'handovers' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Handover Notifications</h2>
              {handovers.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No handovers</p>
              ) : (
                <div className="space-y-4">
                  {handovers.map((handover) => (
                    <div
                      key={handover.id}
                      className={`border rounded-lg p-4 ${
                        !handover.is_read ? 'bg-yellow-50 border-yellow-200' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{handover.end_user_name}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            Reason: {handover.reason || 'Twin requested assistance'}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            {new Date(handover.created_at).toLocaleString()}
                          </p>
                        </div>
                        {!handover.is_accepted && (
                          <button
                            className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm"
                            onClick={() => window.open(`/chat/${twin!.id}`, '_blank')}
                          >
                            Take Over
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Semantic Search Tab */}
        {activeTab === 'search' && (
          <div>
            <SemanticSearch twinId={twin!.id} />
          </div>
        )}

        {/* Knowledge Base Tab */}
        {activeTab === 'knowledge' && (
          <div className="space-y-6">
            {/* File Upload Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Upload Documents</h2>
              <p className="text-sm text-gray-600 mb-4">
                Upload PDF, TXT, Markdown, or CSV files. Files will be automatically chunked and converted to embeddings for semantic search.
              </p>
              <FileUploadDropZone
                twinId={twin!.id}
                onUploadSuccess={handleFileUploadSuccess}
                onUploadError={(error: string) => toast.error(error)}
              />
            </div>

            {/* Uploaded Files List */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Uploaded Files</h2>
              <KnowledgeBaseFileList
                twinId={twin!.id}
                files={uploadedFiles}
                onFileDeleted={handleFileDeleted}
              />
            </div>

            {/* Web Scraping Configurations */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold">Web Scraping Automations</h2>
                <p className="text-sm text-gray-600 mt-2">
                  Configure website sources that will be cleaned, chunked, and added automatically to your knowledge base.
                </p>
              </div>
              <WebScrapingTab />
            </div>

            {/* Manual Entry Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Add Manual Knowledge Entry</h2>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Question or topic"
                  value={newKnowledge.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewKnowledge({ ...newKnowledge, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
                <textarea
                  rows={4}
                  placeholder="Answer or information"
                  value={newKnowledge.content}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewKnowledge({ ...newKnowledge, content: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={addKnowledgeEntry}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Add Entry
                </button>
              </div>
            </div>

            {/* Manual Entries List */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Manual Knowledge Entries</h2>
              {knowledgeBase.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No manual entries yet</p>
              ) : (
                <div className="space-y-4">
                  {knowledgeBase.map((entry) => (
                    <div key={entry.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold">{entry.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{entry.content}</p>
                        </div>
                        <button
                          onClick={() => deleteKnowledgeEntry(entry.id)}
                          className="ml-4 text-red-600 hover:text-red-700 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Email Tab */}
        {activeTab === 'email' && (
          <div className="space-y-6">
            {!emailConnected ? (
              <EmailConnectionCard onConnectionSuccess={loadDashboardData} />
            ) : (
              <>
                {/* Email Sync Status */}
                {emailSyncStatus && (
                  <EmailSyncStatus
                    syncStatus={emailSyncStatus}
                    onSyncComplete={loadDashboardData}
                  />
                )}

                {/* Email List */}
                <EmailList />

                {/* Email Settings */}
                {emailSyncStatus && (
                  <EmailSettings
                    syncStatus={emailSyncStatus}
                    onDisconnect={loadDashboardData}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && twin && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-6">Digital Twin Settings</h2>
            <KnowledgeBaseSettings twin={twin} onUpdate={loadDashboardData} />
          </div>
        )}
      </div>
    </div>
  );
}
