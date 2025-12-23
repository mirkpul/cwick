import { useEffect, useMemo, useState } from 'react';
import { GlobeAltIcon, ClockIcon, PlayIcon, PencilSquareIcon, TrashIcon, ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { webScrapingAPI } from '../../services/api';
import { WebScrapeRun, WebSource, WebSourcePayload, WebScrapeStrategy, WebScrapeScreenshot } from '../../types/webScraping';

interface WebSourceFormState {
  name: string;
  baseUrl: string;
  scrapeStrategy: WebScrapeStrategy;
  crawlDepth: string;
  maxPages: string;
  autoRefreshEnabled: boolean;
  scheduleFrequencyHours: string;
  includePaths: string;
  excludePaths: string;
  contentSelector: string;
  notes: string;
}

const initialFormState: WebSourceFormState = {
  name: '',
  baseUrl: '',
  scrapeStrategy: 'single_page',
  crawlDepth: '1',
  maxPages: '20',
  autoRefreshEnabled: false,
  scheduleFrequencyHours: '24',
  includePaths: '',
  excludePaths: '',
  contentSelector: '',
  notes: '',
};

const strategyDescriptions: Record<WebScrapeStrategy, string> = {
  single_page: 'Capture a single page (great for landing pages or docs).',
  crawl: 'Crawl links under the same domain up to the configured depth.',
};

const parsePaths = (value: string): string[] =>
  value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const WebScrapingTab = (): React.JSX.Element => {
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [sources, setSources] = useState<WebSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [formState, setFormState] = useState<WebSourceFormState>(initialFormState);
  const [historyBySource, setHistoryBySource] = useState<Record<string, WebScrapeRun[]>>({});
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [runningSourceId, setRunningSourceId] = useState<string | null>(null);
  const [downloadingScreenshotKey, setDownloadingScreenshotKey] = useState<string | null>(null);

  const loadSources = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await webScrapingAPI.listSources();
      setSources(response.data.sources || []);
    } catch {
      toast.error('Unable to load web sources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSources();
  }, []);

  const resetForm = (): void => {
    setSelectedSourceId(null);
    setFormState(initialFormState);
  };

  const handleEdit = (source: WebSource): void => {
    setSelectedSourceId(source.id);
    setFormState({
      name: source.name,
      baseUrl: source.baseUrl,
      scrapeStrategy: source.scrapeStrategy,
      crawlDepth: String(source.crawlDepth),
      maxPages: String(source.maxPages),
      autoRefreshEnabled: source.autoRefreshEnabled,
      scheduleFrequencyHours: String(source.scheduleFrequencyHours),
      includePaths: source.includePaths.join('\n'),
      excludePaths: source.excludePaths.join('\n'),
      contentSelector: source.config?.contentSelector || '',
      notes: source.config?.notes || '',
    });
  };

  const toPayload = (): WebSourcePayload => {
    const crawlDepth = parseInt(formState.crawlDepth, 10) || 1;
    const maxPages = parseInt(formState.maxPages, 10) || 1;
    const scheduleFrequencyHours = parseInt(formState.scheduleFrequencyHours, 10) || 24;

    return {
      name: formState.name.trim(),
      baseUrl: formState.baseUrl.trim(),
      scrapeStrategy: formState.scrapeStrategy,
      crawlDepth,
      maxPages,
      autoRefreshEnabled: formState.autoRefreshEnabled,
      scheduleFrequencyHours,
      includePaths: parsePaths(formState.includePaths),
      excludePaths: parsePaths(formState.excludePaths),
      contentSelector: formState.contentSelector.trim() || undefined,
      notes: formState.notes.trim() || undefined,
    };
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!formState.name.trim() || !formState.baseUrl.trim()) {
      toast.error('Please provide at least a name and a URL');
      return;
    }

    const payload = toPayload();

    setSubmitting(true);
    try {
      if (selectedSourceId) {
        await webScrapingAPI.updateSource(selectedSourceId, payload);
        toast.success('Web source updated');
      } else {
        await webScrapingAPI.createSource(payload);
        toast.success('Web source created');
      }
      resetForm();
      await loadSources();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(message || 'Unable to save web source');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (source: WebSource): Promise<void> => {
    if (!confirm(`Delete "${source.name}" and remove all scraped knowledge?`)) {
      return;
    }

    try {
      await webScrapingAPI.deleteSource(source.id);
      toast.success('Web source deleted');
      if (selectedSourceId === source.id) {
        resetForm();
      }
      await loadSources();
    } catch {
      toast.error('Unable to delete web source');
    }
  };

  const handleTrigger = async (sourceId: string): Promise<void> => {
    setRunningSourceId(sourceId);
    try {
      await webScrapingAPI.triggerScrape(sourceId);
      toast.success('Scrape started');
    } catch {
      toast.error('Unable to trigger scrape');
    } finally {
      setRunningSourceId(null);
    }
  };

  const toggleHistory = async (sourceId: string): Promise<void> => {
    if (historyOpenId === sourceId) {
      setHistoryOpenId(null);
      return;
    }

    if (!historyBySource[sourceId]) {
      setHistoryLoadingId(sourceId);
      try {
        const response = await webScrapingAPI.listRuns(sourceId, 10);
        setHistoryBySource((prev) => ({
          ...prev,
          [sourceId]: response.data.runs || [],
        }));
      } catch {
        toast.error('Unable to load run history');
      } finally {
        setHistoryLoadingId(null);
      }
    }

    setHistoryOpenId(sourceId);
  };

  const strategyOptions = useMemo(
    () => [
      { value: 'single_page', label: 'Single page' },
      { value: 'crawl', label: 'Crawl site' },
    ],
    []
  );

  const handleDownloadScreenshot = async (runId: string, screenshot: WebScrapeScreenshot): Promise<void> => {
    const key = `${runId}:${screenshot.filename}`;
    setDownloadingScreenshotKey(key);
    try {
      const response = await webScrapingAPI.downloadScreenshot(runId, screenshot.filename);
      const blob = new Blob([response.data], { type: 'image/png' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = screenshot.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Unable to download screenshot');
    } finally {
      setDownloadingScreenshotKey(null);
    }
  };

  const renderScreenshots = (run: WebScrapeRun): React.ReactNode => {
    if (!run.screenshots || run.screenshots.length === 0) {
      return null;
    }

    return (
      <div className="mt-2">
        <p className="text-xs font-medium text-gray-600 mb-1">Screenshots</p>
        <div className="flex flex-wrap gap-2">
          {run.screenshots.map((shot: WebScrapeScreenshot) => {
            const key = `${run.id}:${shot.filename}`;
            const isDownloading = downloadingScreenshotKey === key;
            return (
              <button
                key={shot.filename}
                onClick={() => handleDownloadScreenshot(run.id, shot)}
                disabled={isDownloading}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 border border-primary-200 rounded hover:bg-primary-50 disabled:opacity-50"
              >
                {isDownloading ? (
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    Downloading...
                  </span>
                ) : (
                  <>
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    {shot.filename}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <GlobeAltIcon className="h-6 w-6 text-primary-600" />
            <div>
              <h2 className="text-xl font-bold">
                {selectedSourceId ? 'Update Web Source' : 'Add Web Source'}
              </h2>
              <p className="text-sm text-gray-600">
                Scrape website content into your knowledge base and keep it fresh with automatic refresh.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source name</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500"
                placeholder="e.g. Company Blog"
                value={formState.name}
                onChange={(e) => setFormState({ ...formState, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
              <input
                type="url"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500"
                placeholder="https://example.com/blog"
                value={formState.baseUrl}
                onChange={(e) => setFormState({ ...formState, baseUrl: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scraping strategy</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500"
                value={formState.scrapeStrategy}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    scrapeStrategy: e.target.value as WebScrapeStrategy,
                  })
                }
              >
                {strategyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">{strategyDescriptions[formState.scrapeStrategy]}</p>
            </div>

            {formState.scrapeStrategy === 'crawl' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Crawl depth</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500"
                    value={formState.crawlDepth}
                    onChange={(e) => setFormState({ ...formState, crawlDepth: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max pages</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500"
                    value={formState.maxPages}
                    onChange={(e) => setFormState({ ...formState, maxPages: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Include paths</label>
              <textarea
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500"
                placeholder="/docs, /blog"
                value={formState.includePaths}
                onChange={(e) => setFormState({ ...formState, includePaths: e.target.value })}
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional. Comma or newline separated path prefixes to include.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exclude paths</label>
              <textarea
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500"
                placeholder="/legal, /careers"
                value={formState.excludePaths}
                onChange={(e) => setFormState({ ...formState, excludePaths: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content selector</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500"
                placeholder=".article-content"
                value={formState.contentSelector}
                onChange={(e) => setFormState({ ...formState, contentSelector: e.target.value })}
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional CSS selector to target the main content area.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500"
                placeholder="Internal description or reminder"
                value={formState.notes}
                onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
              />
            </div>

            <div className="rounded-lg border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Auto refresh</p>
                  <p className="text-xs text-gray-500">
                    Automatically re-scrape this source on a schedule.
                  </p>
                </div>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-5 w-5 text-primary-600 border-gray-300 rounded"
                    checked={formState.autoRefreshEnabled}
                    onChange={(e) => setFormState({ ...formState, autoRefreshEnabled: e.target.checked })}
                  />
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Refresh frequency (hours)
                </label>
                <input
                  type="number"
                  min={1}
                  max={168}
                  disabled={!formState.autoRefreshEnabled}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
                  value={formState.scheduleFrequencyHours}
                  onChange={(e) => setFormState({ ...formState, scheduleFrequencyHours: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {submitting ? 'Saving...' : selectedSourceId ? 'Update Source' : 'Add Source'}
              </button>
              {selectedSourceId && (
                <button
                  type="button"
                  className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Configured sources</h2>
              <p className="text-sm text-gray-600">
                Manage crawling schedule, trigger manual updates, and inspect history.
              </p>
            </div>
            <button
              onClick={() => void loadSources()}
              className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
            >
              <ArrowPathIcon className="h-5 w-5" />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-10 w-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-600">No web sources yet. Add one to begin scraping.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sources.map((source) => (
                <div key={source.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-wrap gap-4 justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{source.name}</h3>
                      <a
                        href={source.baseUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary-600 break-all"
                      >
                        {source.baseUrl}
                      </a>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-1 bg-primary-50 text-primary-700 rounded-full">
                          {source.scrapeStrategy === 'single_page' ? 'Single page' : `Crawl · depth ${source.crawlDepth}`}
                        </span>
                        {source.autoRefreshEnabled && (
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full">
                            Auto · {source.scheduleFrequencyHours}h
                          </span>
                        )}
                        {source.includePaths.length > 0 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                            Include {source.includePaths.length} paths
                          </span>
                        )}
                        {source.excludePaths.length > 0 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                            Exclude {source.excludePaths.length} paths
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                        onClick={() => handleEdit(source)}
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                        onClick={() => handleTrigger(source.id)}
                        disabled={runningSourceId === source.id}
                      >
                        <PlayIcon className="h-4 w-4" />
                        {runningSourceId === source.id ? 'Starting...' : 'Run now'}
                      </button>
                      <button
                        className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(source)}
                      >
                        <TrashIcon className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <ClockIcon className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-gray-500 text-xs">Last status</p>
                        <p className="font-medium capitalize">
                          {source.lastStatus ? source.lastStatus.replace('_', ' ') : 'Never'}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Last run</p>
                      <p className="font-medium">{formatDate(source.lastRunAt || source.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Next scheduled run</p>
                      <p className="font-medium">{source.autoRefreshEnabled ? formatDate(source.nextRunAt) : 'Manual only'}</p>
                    </div>
                  </div>

                  {source.lastError && (
                    <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
                      Last error: {source.lastError}
                    </p>
                  )}

                  <div className="mt-3">
                    <button
                      className="text-sm text-primary-600 hover:text-primary-700"
                      onClick={() => void toggleHistory(source.id)}
                    >
                      {historyOpenId === source.id ? 'Hide history' : 'View latest runs'}
                    </button>

                    {historyOpenId === source.id && (
                      <div className="mt-3 border border-gray-100 rounded-lg p-3 bg-gray-50">
                        {historyLoadingId === source.id ? (
                          <p className="text-sm text-gray-600">Loading history...</p>
                        ) : (historyBySource[source.id] || []).length === 0 ? (
                          <p className="text-sm text-gray-600">No runs logged yet.</p>
                        ) : (
                          <ul className="space-y-3 text-sm">
                            {historyBySource[source.id]!.map((run) => (
                              <li key={run.id} className="border-b border-gray-200 pb-2 last:border-none last:pb-0">
                                <div className="flex justify-between">
                                  <div>
                                    <p className="font-medium capitalize">{run.status}</p>
                                    <p className="text-xs text-gray-500">
                                      Started {formatDate(run.startedAt)} · {run.triggerType} · {run.pagesProcessed} pages
                                    </p>
                                  </div>
                                  {run.error && <p className="text-xs text-red-600 max-w-[200px] text-right">{run.error}</p>}
                                </div>
                                {renderScreenshots(run)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebScrapingTab;
