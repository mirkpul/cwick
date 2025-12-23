# Web Scraping Knowledge Sources

The knowledge tab now supports configurable website sources. Every run renders the target pages with Puppeteer, cleans the text, chunks it, and stores the results in the knowledge base alongside manual entries and uploaded files.

## How it works

1. **Configuration (frontend)** – From the *Knowledge* tab add one or more sources by URL. You can specify the scrape strategy (single page or crawl), include/exclude path prefixes, optional CSS selector, and a refresh frequency.
2. **Rendering (backend)** – Each page is rendered headlessly with Chromium (Puppeteer). The HTML is cleaned from obvious overlays (cookies, ads, signup banners). If `SCRAPER_ENABLE_SCREENSHOTS=true`, a PNG is saved per page for debugging.
3. **Chunking & Ingestion** – Clean text is chunked, embedded, and inserted into `knowledge_base` with metadata (`sourceId`, `url`, `scrapeStrategy`, `screenshotFilename` when enabled, etc.).
4. **Scheduling** – Auto-refreshing sources are run by a background scheduler. Manual runs can be triggered from the dashboard.
5. **Screenshots (debug-only)** – Optional PNGs are stored in `data/web-scraping/<twinId>/<runId>/screenshots` only when `SCRAPER_ENABLE_SCREENSHOTS=true`. The dashboard provides authenticated download links when screenshots are present.

## API Overview

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/web-scraping` | List sources for the current twin. |
| `POST` | `/api/web-scraping` | Create a source. |
| `PUT` | `/api/web-scraping/:sourceId` | Update a source. |
| `DELETE` | `/api/web-scraping/:sourceId` | Delete a source (and its KB entries). |
| `POST` | `/api/web-scraping/:sourceId/run` | Trigger a manual run. |
| `GET` | `/api/web-scraping/:sourceId/runs` | List recent runs (includes screenshots when enabled). |
| `GET` | `/api/web-scraping/runs/:runId/screenshots/:filename` | Download a screenshot for a run. |

## Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `WEB_SCRAPER_SCHEDULER_INTERVAL_MS` | `300000` | Interval between scheduler checks. |
| `WEB_SCRAPER_RENDER_TIMEOUT_MS` | `30000` | Puppeteer `page.goto` timeout. |
| `WEB_SCRAPER_POST_RENDER_WAIT_MS` | `1500` | Additional wait after render before capturing content. |
| `PUPPETEER_EXECUTABLE_PATH` | `undefined` | Path to Chromium binary (Docker image uses `/usr/bin/chromium-browser`). |
| `PUPPETEER_HEADLESS` | `true` | Set to `false` for debugging. |

## Docker Notes

The backend image now installs Alpine Chromium and sets `PUPPETEER_SKIP_DOWNLOAD=true` so that Puppeteer uses the system browser. Remember to rebuild the backend image (`docker compose build backend`) after pulling these changes.
