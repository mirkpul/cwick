export type WebScrapeStrategy = 'single_page' | 'crawl';

export interface WebSourceConfig {
  contentSelector?: string | null;
  notes?: string | null;
}

export interface WebSource {
  id: string;
  twinId: string;
  name: string;
  baseUrl: string;
  scrapeStrategy: WebScrapeStrategy;
  crawlDepth: number;
  maxPages: number;
  autoRefreshEnabled: boolean;
  scheduleFrequencyHours: number;
  includePaths: string[];
  excludePaths: string[];
  config?: WebSourceConfig;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  lastStatus?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebScrapeRun {
  id: string;
  sourceId: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  triggerType: 'manual' | 'auto';
  pagesProcessed: number;
  entriesAdded: number;
  error?: string | null;
  screenshots?: WebScrapeScreenshot[];
}

export interface WebSourcePayload {
  name: string;
  baseUrl: string;
  scrapeStrategy: WebScrapeStrategy;
  crawlDepth: number;
  maxPages: number;
  autoRefreshEnabled: boolean;
  scheduleFrequencyHours: number;
  includePaths: string[];
  excludePaths: string[];
  contentSelector?: string;
  notes?: string;
}

export interface WebScrapeScreenshot {
  filename: string;
  url: string;
}
