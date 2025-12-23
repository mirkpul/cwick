# Web Scraping Service

Web scraping service (extracted from monolith) with sources CRUD + scrape trigger, backed by Postgres tables `web_sources` and `web_scrape_runs`. A basic Puppeteer runner visits the source URL and captures a screenshot.

## Endpoints
- `GET /health`
- `GET /sources?twinId=...`
- `POST /sources` (body: `CreateWebSourceRequest` + `twinId`)
- `PUT /sources/:sourceId` (body: partial update + `twinId`)
- `DELETE /sources/:sourceId?twinId=...`
- `GET /sources/:sourceId/runs?twinId=...&limit=20`
- `POST /sources/:sourceId/scrape` (body: `TriggerScrapeRequest` + `twinId`)
- `GET /runs/:runId/screenshot` (returns PNG if available)

Responses use `ApiResponse` wrapper.

## Environment
- `PORT` (default 3013)
- `DATABASE_URL` (Postgres) – required
- `LOG_LEVEL`
- `SCRAPER_DATA_DIR` (default `data/web-scraping`)
- `PUPPETEER_EXECUTABLE_PATH` (auto-set in Docker to `/usr/bin/chromium`)
- `WEB_SCRAPING_REDIS_URL` (BullMQ/Redis queue; default `redis://localhost:6379`)
- `SCRAPER_CONCURRENCY` (queue worker concurrency, default 2)
- `SCRAPER_SCHEDULER_INTERVAL_MS` (default 300000)
- `WEB_SCRAPING_ROLE` (`api` | `worker` | `api-worker`, default `api-worker`)
- `SCRAPER_ENABLE_SCREENSHOTS` (default `false`; when `true` saves local PNGs and enables screenshot endpoint)

## Dev
```bash
npm run dev --workspace=@virtualcoach/web-scraping-service
npm run type-check --workspace=@virtualcoach/web-scraping-service
npm run test --workspace=@virtualcoach/web-scraping-service
```

## Notes
- `/scrape` triggers a background Puppeteer run (single-page, screenshot only) and marks the run completed/failed.
- Queue: BullMQ + Redis handles scrape jobs; worker runs in-process alongside the API.
- Scheduler: periodic enqueue of due sources based on `next_run_at`/`schedule_frequency_hours`.
- Screenshots (debug-only) are stored under `SCRAPER_DATA_DIR` with filename `${runId}.png` when `SCRAPER_ENABLE_SCREENSHOTS=true`.
