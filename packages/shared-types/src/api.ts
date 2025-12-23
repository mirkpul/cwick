/**
 * API contract types for service-to-service communication
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  service: string;
  version: string;
  uptime: number;
  timestamp: Date;
  dependencies?: {
    [key: string]: 'up' | 'down';
  };
}

// Encryption Service API
export interface EncryptRequest {
  plaintext: string;
}

export interface EncryptResponse {
  ciphertext: string;
}

export interface DecryptRequest {
  ciphertext: string;
}

export interface DecryptResponse {
  plaintext: string;
}

export interface DetectSensitiveDataRequest {
  text: string;
}

export interface DetectSensitiveDataResponse {
  hasSensitiveData: boolean;
  detectedPatterns: string[];
  redactedText: string;
}

// LLM Gateway API
export interface GenerateResponseRequest {
  messages: Array<{ role: string; content: string }>;
  provider: 'openai' | 'anthropic';
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface GenerateEmbeddingRequest {
  text: string | string[];
  model?: string;
  provider?: 'openai' | 'anthropic';
}

// Web Scraping Service API
export interface CreateWebSourceRequest {
  twinId: string;
  url: string;
  name: string;
  cssSelectors?: string[];
  autoRefresh: boolean;
  refreshFrequencyHours?: number;
}

export interface TriggerScrapeRequest {
  sourceId: string;
  force?: boolean;
}

export interface WebScrapingStatus {
  sourceId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  lastRun?: Date;
  nextScheduledRun?: Date;
}

export interface WebSource {
  id: string;
  twin_id: string;
  name: string;
  base_url: string;
  scrape_strategy: 'single_page' | 'crawl';
  crawl_depth: number;
  max_pages: number;
  auto_refresh_enabled: boolean;
  schedule_frequency_hours: number;
  include_paths: string[];
  exclude_paths: string[];
  config: Record<string, unknown> | null;
  last_run_at: Date | null;
  next_run_at: Date | null;
  last_status: string | null;
  last_error: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WebScrapeRun {
  id: string;
  source_id: string;
  started_at: Date;
  completed_at: Date | null;
  status: string;
  trigger_type: string;
  pages_processed: number;
  entries_added: number;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}

// Vector Service API
export interface VectorUpsertRequest {
  id: string;
  vector: number[];
  namespace?: string;
  metadata?: Record<string, unknown>;
}

export interface VectorBatchUpsertRequest {
  items: VectorUpsertRequest[];
}

export interface VectorSearchRequest {
  vector: number[];
  namespace?: string;
  limit?: number;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

// Auth Service API
export interface AuthRegisterRequest {
  email: string;
  password: string;
  fullName: string;
  role?: string;
}

export interface AuthLoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active?: boolean;
  email_verified?: boolean;
  created_at?: Date;
}

export interface AuthRegisterResponse {
  user: AuthUser;
  token: string;
}

export interface AuthLoginResponse {
  user: AuthUser;
  token: string;
}

export interface AuthMeResponse {
  user: AuthUser;
}
