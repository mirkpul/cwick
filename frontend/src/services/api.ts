/// <reference types="vite/client" />
import axios, { AxiosProgressEvent, AxiosResponse } from 'axios';
import { getToken, clearAuth } from '../utils/authStorage';
import { RAGConfig } from '../types/rag';
import { WebScrapeRun, WebSource, WebSourcePayload } from '../types/webScraping';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuth();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Type definitions
interface RegisterData {
  email: string;
  password: string;
  name: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface KnowledgeBaseData {
  name?: string;
  description?: string;
  system_prompt?: string;
  llm_provider?: string;
  llm_model?: string;
  temperature?: number;
  max_tokens?: number;
  purpose?: string;
  purpose_config?: PurposeConfig;
}

interface PurposeConfig {
  requireClarifyingQuestions?: boolean;
  requiredInputs?: string[];
  clarifyingPrompt?: string;
}

interface KnowledgeData {
  question: string;
  answer: string;
  category?: string;
}

interface ConversationStartData {
  end_user_name?: string;
  end_user_email?: string;
}

interface MessageData {
  content: string;
}

interface DatasetData {
  kb_id: string;
  name: string;
  description?: string;
}

interface QuestionData {
  question: string;
  expected_answer?: string;
  category?: string;
  difficulty?: string;
}

interface GenerateOptions {
  count?: number;
  categories?: string[];
}

interface GenerateDatasetData {
  kb_id: string;
  name: string;
  count?: number;
}

interface RunData {
  dataset_id: string;
  name?: string;
  config?: Record<string, unknown>;
}

interface CompareData {
  runIdA: string;
  runIdB: string;
}

interface EvaluationData {
  question: string;
  answer: string;
  context?: string;
  expected_answer?: string;
}

interface HumanEvaluationData {
  score: number;
  feedback?: string;
}

interface ImapCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
  tls?: boolean;
}

interface EmailListParams {
  page?: number;
  limit?: number;
  search?: string;
}

interface WebSourceListResponse {
  sources: WebSource[];
}

interface WebScrapeRunListResponse {
  runs: WebScrapeRun[];
}

// Auth API
export const authAPI = {
  register: (data: RegisterData): Promise<AxiosResponse> => api.post('/auth/register', data),
  login: (data: LoginData): Promise<AxiosResponse> => api.post('/auth/login', data),
  getMe: (): Promise<AxiosResponse> => api.get('/auth/me'),
};

// Knowledge Base API
export const knowledgeBaseAPI = {
  create: (data: KnowledgeBaseData): Promise<AxiosResponse> => api.post('/knowledge-bases', data),
  getMyKB: (): Promise<AxiosResponse> => api.get('/knowledge-bases/me'),
  update: (kbId: string, data: KnowledgeBaseData): Promise<AxiosResponse> => api.put(`/knowledge-bases/${kbId}`, data),
  addKnowledge: (kbId: string, data: KnowledgeData): Promise<AxiosResponse> => api.post(`/knowledge-bases/${kbId}/knowledge`, data),
  getKnowledge: (kbId: string): Promise<AxiosResponse> => api.get(`/knowledge-bases/${kbId}/knowledge`),
  deleteKnowledge: (kbId: string, entryId: string): Promise<AxiosResponse> => api.delete(`/knowledge-bases/${kbId}/knowledge/${entryId}`),

  // File upload endpoints
  uploadKnowledgeFile: (kbId: string, formData: FormData, onUploadProgress?: (progressEvent: AxiosProgressEvent) => void): Promise<AxiosResponse> =>
    api.post(`/knowledge-bases/${kbId}/knowledge/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    }),
  listKnowledgeFiles: (kbId: string): Promise<AxiosResponse> => api.get(`/knowledge-bases/${kbId}/knowledge/files`),
  deleteKnowledgeFile: (kbId: string, entryId: string): Promise<AxiosResponse> => api.delete(`/knowledge-bases/${kbId}/knowledge/file/${entryId}`),
  searchKnowledge: (kbId: string, query: string, limit = 10): Promise<AxiosResponse> =>
    api.get(`/knowledge-bases/${kbId}/knowledge/search`, {
      params: { q: query, limit }
    }),

  // RAG Configuration endpoints
  getRAGConfig: (kbId: string): Promise<AxiosResponse> => api.get(`/knowledge-bases/${kbId}/rag-config`),
  updateRAGConfig: (kbId: string, config: RAGConfig): Promise<AxiosResponse> => api.put(`/knowledge-bases/${kbId}/rag-config`, config),
};

// Chat API
export const chatAPI = {
  startConversation: (kbId: string, data: ConversationStartData): Promise<AxiosResponse> => api.post(`/chat/conversations/${kbId}/start`, data),
  sendMessage: (conversationId: string, data: MessageData): Promise<AxiosResponse> => api.post(`/chat/conversations/${conversationId}/messages`, data),
  getMessages: (conversationId: string, limit?: number): Promise<AxiosResponse> => api.get(`/chat/conversations/${conversationId}/messages`, { params: { limit } }),
  getMyConversations: (): Promise<AxiosResponse> => api.get('/chat/my-conversations'),
};

// Benchmark API
export const benchmarkAPI = {
  // Datasets
  createDataset: (data: DatasetData): Promise<AxiosResponse> => api.post('/benchmark/datasets', data),
  listDatasets: (kbId: string): Promise<AxiosResponse> => api.get('/benchmark/datasets', { params: { kbId } }),
  getDataset: (datasetId: string): Promise<AxiosResponse> => api.get(`/benchmark/datasets/${datasetId}`),
  updateDataset: (datasetId: string, data: Partial<DatasetData>): Promise<AxiosResponse> => api.put(`/benchmark/datasets/${datasetId}`, data),
  deleteDataset: (datasetId: string): Promise<AxiosResponse> => api.delete(`/benchmark/datasets/${datasetId}`),
  exportDataset: (datasetId: string): Promise<AxiosResponse> => api.get(`/benchmark/datasets/${datasetId}/export`),
  importDataset: (kbId: string, data: unknown): Promise<AxiosResponse> => api.post('/benchmark/datasets/import', { kbId, data }),

  // Questions
  addQuestion: (datasetId: string, data: QuestionData): Promise<AxiosResponse> => api.post(`/benchmark/datasets/${datasetId}/questions`, data),
  bulkAddQuestions: (datasetId: string, questions: QuestionData[]): Promise<AxiosResponse> => api.post(`/benchmark/datasets/${datasetId}/questions/bulk`, { questions }),
  listQuestions: (datasetId: string): Promise<AxiosResponse> => api.get(`/benchmark/datasets/${datasetId}/questions`),
  updateQuestion: (questionId: string, data: Partial<QuestionData>): Promise<AxiosResponse> => api.put(`/benchmark/questions/${questionId}`, data),
  deleteQuestion: (questionId: string): Promise<AxiosResponse> => api.delete(`/benchmark/questions/${questionId}`),

  // Synthetic generation
  generateQuestions: (datasetId: string, options: GenerateOptions): Promise<AxiosResponse> => api.post(`/benchmark/datasets/${datasetId}/generate`, options),
  generateDataset: (data: GenerateDatasetData): Promise<AxiosResponse> => api.post('/benchmark/generate-dataset', data),

  // Runs
  createRun: (data: RunData): Promise<AxiosResponse> => api.post('/benchmark/runs', data),
  listRuns: (kbId: string): Promise<AxiosResponse> => api.get('/benchmark/runs', { params: { kbId } }),
  getRun: (runId: string): Promise<AxiosResponse> => api.get(`/benchmark/runs/${runId}`),
  startRun: (runId: string): Promise<AxiosResponse> => api.post(`/benchmark/runs/${runId}/start`),
  cancelRun: (runId: string): Promise<AxiosResponse> => api.post(`/benchmark/runs/${runId}/cancel`),
  deleteRun: (runId: string): Promise<AxiosResponse> => api.delete(`/benchmark/runs/${runId}`),
  getRunResults: (runId: string): Promise<AxiosResponse> => api.get(`/benchmark/runs/${runId}/results`),

  // Comparison
  compareRuns: (runIdA: string, runIdB: string): Promise<AxiosResponse> => api.post('/benchmark/compare', { runIdA, runIdB } as CompareData),

  // Evaluation
  evaluate: (data: EvaluationData): Promise<AxiosResponse> => api.post('/benchmark/evaluate', data),
  evaluateFaithfulness: (data: EvaluationData): Promise<AxiosResponse> => api.post('/benchmark/evaluate/faithfulness', data),
  evaluateRelevance: (data: EvaluationData): Promise<AxiosResponse> => api.post('/benchmark/evaluate/relevance', data),
  detectHallucinations: (data: EvaluationData): Promise<AxiosResponse> => api.post('/benchmark/detect-hallucinations', data),

  // Human evaluation
  submitHumanEvaluation: (resultId: string, data: HumanEvaluationData): Promise<AxiosResponse> => api.put(`/benchmark/results/${resultId}/evaluate`, data),
};

// Email API
export const emailAPI = {
  getGmailAuthUrl: (): Promise<AxiosResponse> => api.get('/email/auth/gmail'),
  getOutlookAuthUrl: (): Promise<AxiosResponse> => api.get('/email/auth/outlook'),
  storeImapCredentials: (data: ImapCredentials): Promise<AxiosResponse> => api.post('/email/auth/imap', data),
  triggerSync: (type: 'full' | 'incremental' = 'incremental'): Promise<AxiosResponse> => api.post('/email/sync', { type }),
  getSyncStatus: (): Promise<AxiosResponse> => api.get('/email/sync/status'),
  toggleAutoSync: (enabled: boolean): Promise<AxiosResponse> => api.put('/email/auto-sync', { enabled }),
  listEmails: (params: EmailListParams): Promise<AxiosResponse> => api.get('/email/list', { params }),
  searchEmails: (query: string, limit = 10): Promise<AxiosResponse> => api.post('/email/search', { query, limit }),
  deleteEmail: (emailId: string): Promise<AxiosResponse> => api.delete(`/email/${emailId}`),
  disconnectEmail: (): Promise<AxiosResponse> => api.delete('/email/disconnect'),
};

// Web Scraping API
export const webScrapingAPI = {
  listSources: (): Promise<AxiosResponse<WebSourceListResponse>> => api.get('/web-scraping'),
  createSource: (data: WebSourcePayload): Promise<AxiosResponse<{ source: WebSource }>> => api.post('/web-scraping', data),
  updateSource: (sourceId: string, data: Partial<WebSourcePayload>): Promise<AxiosResponse<{ source: WebSource }>> =>
    api.put(`/web-scraping/${sourceId}`, data),
  deleteSource: (sourceId: string): Promise<AxiosResponse> => api.delete(`/web-scraping/${sourceId}`),
  triggerScrape: (sourceId: string): Promise<AxiosResponse> => api.post(`/web-scraping/${sourceId}/run`),
  listRuns: (sourceId: string, limit = 10): Promise<AxiosResponse<WebScrapeRunListResponse>> =>
    api.get(`/web-scraping/${sourceId}/runs`, { params: { limit } }),
  downloadScreenshot: (runId: string, filename: string): Promise<AxiosResponse<Blob>> =>
    api.get(`/web-scraping/runs/${runId}/screenshots/${filename}`, {
      responseType: 'blob',
    }),
};

export default api;
