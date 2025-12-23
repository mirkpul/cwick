# Digital Twin SAAS Platform

A comprehensive SAAS platform for professionals to create and manage AI-powered digital twins. Inspired by Botpress, it enables creating conversational AI agents (OpenAI/Anthropic) that can handle Q&A, scheduling, and seamless human handover.

## 📚 Documentation

The documentation has been reorganized into the `docs/` directory:

### 🚀 Getting Started
- **[Setup & Quick Start Guide](docs/setup/guide.md)**: Installation, Docker setup, and first steps.
- **[Configuration Guide](docs/backend/configuration.md)**: Backend configuration options.
- **[Contributing Guide](docs/contributing.md)**: How to contribute to the project.

### 🧠 RAG & AI Engine
- **[RAG Optimizations](docs/rag/optimizations.md)**: Details on the advanced scoring, cost optimizations, and embedding improvements.
- **[Debugging Guide](docs/rag/debugging.md)**: How to debug RAG pipelines, hallucinations, and search quality.
- **[RAG Configuration](docs/rag/configuration.md)**: Examples for different use cases (Email-heavy, KB-focus, etc.).
- **[Changelog](docs/rag/changelog.md)**: Recent improvements to the AI engine.

### 🛠️ Technical Documentation
- **[Backend API - File Upload](docs/backend/api-file-upload.md)**: API reference for knowledge base management.
- **[LLM Logging](docs/backend/llm-logging.md)**: Details on the interaction logging system.
- **[Frontend Knowledge Base](docs/frontend/knowledge-base.md)**: UI components guide.
- **[Web Scraping](docs/backend/web-scraping.md)**: Configuring website sources, scheduler behavior, and screenshot downloads.

## Tech Stack

- **Backend**: Node.js, Express, PostgreSQL (pgvector), WebSocket, OpenAI/Anthropic SDKs.
- **Frontend**: React 18, Vite, Tailwind CSS.
- **Infrastructure**: Docker, Nginx.

## Architecture Status

- ✅ **Authentication**: JWT-based (Users, Super Admins).
- ✅ **Digital Twins**: Configurable personas and knowledge bases.
- ✅ **RAG Engine**: Advanced hybrid search (Vector + BM25), Reranking, and Adaptive Filtering.
- ✅ **Email Integration**: Gmail/Outlook sync for personalized context.
- ✅ **Real-time Chat**: WebSocket-based with "Professional Takeover" capability.

## Quick Start (Docker)

```bash
cp .env.example .env
# Edit .env with your API keys
docker-compose up --build
```
Access at [http://localhost:3000](http://localhost:3000).

### Microservices (current)
- `ai-core-service` (port 3020) — LLM + RAG + vector + document processing in one service.
- `web-scraping-service` + `web-scraping-worker` (port 3013) — sources CRUD, scheduler + BullMQ, optional screenshots (flag `SCRAPER_ENABLE_SCREENSHOTS`).
- `email-service` (port 3017) — Gmail/Outlook/IMAP sync + embeddings.
- `realtime-service` (port 3018) — WebSocket + chat orchestration (twin responses, handover).

Auth and encryption run inside the backend for now (no separate services).

Key envs:
- `LLM_GATEWAY_URL`
- `VECTOR_SERVICE_URL`, `VECTOR_DEFAULT_NAMESPACE`
- `RAG_RETRIEVAL_URL`
- `DOC_PROCESSING_URL`
- `WEB_SCRAPING_SERVICE_URL`, `WEB_SCRAPING_REDIS_URL`
- `EMAIL_SERVICE_URL`, `EMAIL_RATE_LIMIT_WINDOW_MS`, `EMAIL_RATE_LIMIT_MAX`
- `REALTIME_SERVICE_URL`

---
*Maintained by the Virtual Coach Team*
