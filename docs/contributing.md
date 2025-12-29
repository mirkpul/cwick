# Contributing to RAG Knowledge Base SAAS Platform

## Getting Started

### Prerequisites
- Node.js 18+ or 20+
- PostgreSQL 14+ (with pgvector extension)
- Redis (for web scraping)
- Docker & Docker Compose
- At least one LLM API key (OpenAI, Anthropic, or Google)

### Setup
1. Fork & Clone.
2. `cp .env.example .env` & Configure keys.
3. `docker-compose up` (Recommended) OR `npm run dev` in backend/frontend.

## Development Workflow

1. **Branch**: Create `feature/name` or `fix/name`.
2. **Commit**: Use Conventional Commits (`feat: add login`, `fix: token expiry`).
3. **Verify**: Ensure `npm run lint` and `npm test` pass.

## Quality Standards
- **Backend**: TypeScript + Jest. (Run `npm run type-check`).
- **Frontend**: React + Vitest + Tailwind.
- **Coverage**: Maintain high test coverage.

## Project Structure
- `backend/`: Express API server.
- `frontend/`: React Vite app.
- `database/`: SQL Migrations.
- `docs/`: Project Documentation.

## Pull Requests
- Provide clear description.
- Include screenshots for UI changes.
- Ensure CI passes (Lint + Test + Build).
