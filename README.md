# RAG Knowledge Base SAAS Platform

A comprehensive SAAS platform for professionals to create and manage AI-powered knowledge bases with advanced RAG (Retrieval-Augmented Generation) capabilities. Create conversational AI agents powered by OpenAI (GPT-4), Anthropic (Claude), or Google (Gemini) that can handle Q&A, consultations, and leverage uploaded documents, emails, and web scraping for contextual responses.

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

## Features

- ✅ **Multi-Provider LLM Support**: OpenAI (GPT-4), Anthropic (Claude 3.5), Google (Gemini Pro)
- ✅ **Authentication**: JWT + OAuth (Google/GitHub login)
- ✅ **Knowledge Bases**: Configurable AI agents with custom LLM settings
- ✅ **Advanced RAG Engine**:
  - Hybrid Search (Vector + BM25)
  - Reranking & Diversity Filtering
  - Temporal Decay & MMR
  - Configurable thresholds per source type
- ✅ **Multi-Source Knowledge**:
  - Document Upload (PDF, TXT, MD, CSV)
  - Email Sync (Gmail/Outlook/IMAP)
  - Web Scraping (scheduled with BullMQ)
  - Manual Q&A Entries
- ✅ **Real-time Chat**: WebSocket-based conversations
- ✅ **RAG Benchmarking**: Dataset creation, evaluation, comparison
- ✅ **Context Preview**: See exactly what the AI sees

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
