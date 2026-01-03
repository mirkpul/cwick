# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RAG Knowledge Base SAAS Platform - A comprehensive platform for professionals to create and manage AI-powered knowledge bases with advanced RAG (Retrieval-Augmented Generation) capabilities. The system enables professionals to create conversational AI agents powered by OpenAI (GPT-4), Anthropic (Claude), or Google (Gemini) that can handle Q&A, provide consultations, and leverage uploaded documents, emails, and web scraping for contextual responses.

## Tech Stack

**Backend**: Node.js + Express + TypeScript + PostgreSQL (with pgvector) + WebSocket (ws)
**Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
**Infrastructure**: Docker + Docker Compose + Nginx

## Development Commands

### Backend (from `/backend` directory)

```bash
# Development
npm run dev                  # Start development server with hot reload

# Testing
npm test                     # Run tests (optimized with --runInBand and memory limit)
npm run test:coverage        # Run tests with coverage report

# Code Quality
npm run type-check           # TypeScript type checking
npm run lint                 # Run ESLint
npm run lint:fix             # Auto-fix linting issues

# Build
npm run build                # Compile TypeScript to JavaScript
npm start                    # Run production build
```

### Frontend (from `/frontend` directory)

```bash
# Development
npm run dev                  # Start Vite dev server

# Testing
npm test                     # Run Vitest tests
npm run test:coverage        # Run tests with coverage

# Code Quality
npm run type-check           # TypeScript type checking
npm run lint                 # Run ESLint
npm run lint:fix             # Auto-fix linting issues

# Build
npm run build                # Build for production
npm run preview              # Preview production build
```

### Docker Commands (from project root)

```bash
# Start all services
docker-compose up --build

# Start in background
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Database access
docker exec -it knowledgebase-db psql -U knowledgebase_user -d knowledgebase
```

### Database Commands

```bash
# Run migrations manually
psql -U knowledgebase_user -d knowledgebase -f database/migrations/001_initial_schema.sql
psql -U knowledgebase_user -d knowledgebase -f database/migrations/002_email_knowledge_base.sql

# Access database in Docker
docker exec -it knowledgebase-db psql -U knowledgebase_user -d knowledgebase
```

## Architecture

### High-Level Structure

```
┌─────────────────────────────────────────────────────────────┐
│                         Nginx Proxy                          │
│                         (Port 80)                            │
└───────────────┬─────────────────────────┬───────────────────┘
                │                         │
        ┌───────▼────────┐        ┌──────▼───────┐
        │    Frontend     │        │   Backend    │
        │   React + Vite  │        │   Express    │
        │   (Port 3000)   │        │  (Port 3001) │
        └─────────────────┘        └──────┬───────┘
                                          │
                    ┌─────────────────────┼─────────────────┐
                    │                     │                 │
            ┌───────▼────────┐    ┌──────▼──────┐  ┌──────▼──────┐
            │   PostgreSQL    │    │  WebSocket  │  │ LLM Services│
            │   (Port 5432)   │    │   Server    │  │OpenAI/Claude│
            └─────────────────┘    └─────────────┘  └─────────────┘
```

### Backend Architecture

The backend follows a layered architecture:

**Routes** (`src/routes/`) → **Controllers** → **Services** (`src/services/`) → **Database**

Key backend components:

- **`src/server.ts`**: Main entry point, initializes Express app, middleware, routes, and WebSocket server
- **Routes**:
  - `authRoutes.ts`: Authentication (register, login, OAuth)
  - `knowledgeBaseRoutes.ts`: Knowledge base CRUD, context management, RAG configuration
  - `chatRoutes.ts`: Conversations and messages
  - `emailRoutes.ts`: Email knowledge base integration (Gmail/Outlook/IMAP)
- **Services**:
  - `authService.ts`: Authentication and JWT handling
  - `websocketService.ts`: Real-time communication
  - `emailSyncService.ts`: Orchestrates email synchronization
  - `gmailConnector.ts`, `outlookConnector.ts`, `imapConnector.ts`: Email provider integrations
  - `cryptoService.ts`: AES-256-GCM encryption for sensitive data
  - `sensitiveDataService.ts`: Detects and redacts sensitive information (credit cards, SSNs, etc.)
  - `emailParserService.ts`: Parses and cleans email content
- **Middleware**:
  - `errorHandler.ts`: Centralized error handling
  - `auth.ts`: JWT authentication middleware
  - `rateLimiter.ts`: Rate limiting per endpoint
  - `validateRequest.ts`: Request validation using express-validator

### Frontend Architecture

React application with:

- **`src/App.tsx`**: Main routing configuration using React Router v6
- **Context**: `AuthContext.tsx` provides global authentication state
- **Pages**: Login, Register, Dashboard, Chat widget, Admin panel
- **Styling**: Tailwind CSS with utility-first approach
- **API Communication**: Axios for HTTP requests, WebSocket for real-time chat

### Database Schema

PostgreSQL with pgvector extension for semantic search.

**Core Tables**:
- `users`: KB owners and super admins (role: 'super_admin' | 'kb_owner')
- `knowledge_bases`: Knowledge base configurations (one per user, LLM settings, RAG config)
- `knowledge_base`: FAQ entries with vector embeddings for semantic search
- `email_knowledge`: Imported emails with embeddings (from Gmail/Outlook/IMAP)
- `email_credentials`: Encrypted OAuth tokens and IMAP credentials
- `end_users`: People who chat with knowledge bases
- `conversations`: Chat sessions with status tracking (active, closed)
- `messages`: Individual messages (sender: 'user' | 'assistant')

**Key Features**:
- Vector embeddings (1536 dimensions) using OpenAI's text-embedding-3-small
- Advanced hybrid search (Vector + BM25) with configurable weights
- Reranking and diversity filtering for optimal results
- Semantic search threshold configurable per knowledge base (default 0.70)
- Email sync history tracking
- Web scraping with BullMQ scheduler and optional screenshots

### Email Knowledge Base Integration

New feature on `feature/email-knowledge-base` branch:

**Flow**:
1. User connects email via OAuth (Gmail/Outlook) or IMAP credentials
2. Credentials encrypted using AES-256-GCM (`cryptoService.ts`)
3. Initial sync fetches emails (configurable months back, default 6)
4. Emails parsed, sensitive data detected and redacted (`sensitiveDataService.ts`)
5. Content vectorized and stored in `email_knowledge` table
6. AI twin can semantically search emails during conversations

**API Endpoints**:
- `GET /api/email/auth/gmail` - OAuth flow for Gmail
- `GET /api/email/auth/outlook` - OAuth flow for Outlook
- `POST /api/email/auth/imap` - Store IMAP credentials
- `POST /api/email/sync` - Trigger manual sync
- `GET /api/email/sync/status` - Get sync statistics
- `PUT /api/email/auto-sync` - Enable/disable auto-sync
- `POST /api/email/search` - Semantic search across emails

### WebSocket Communication

WebSocket server runs on same port as HTTP server (3001), path: `/ws`

**Message Types**:
- `authenticate`: Authenticate WebSocket connection
- `join_conversation`: Join a conversation room
- `send_message`: Send message in conversation

### LLM Integration

Supports multiple providers with unified interface:

- **OpenAI**: GPT-4, GPT-3.5-Turbo
- **Anthropic**: Claude 3 (Opus, Sonnet, Haiku), Claude 3.5 Sonnet
- **Google**: Gemini Pro, Gemini Pro Vision

Configuration stored per knowledge base: `llm_provider`, `llm_model`, `temperature`, `max_tokens`, `system_prompt`

## Testing Strategy

### Backend Tests

- Uses Jest with `ts-jest` preset
- Configuration optimized for memory: `--runInBand` and `--max-old-space-size=4096`
- Tests in `src/**/*.test.ts`
- Coverage reports in `coverage/` directory

### Frontend Tests

- Uses Vitest with jsdom environment
- React Testing Library for component tests
- Tests in `src/**/*.test.tsx`

## Environment Variables

Required environment variables (see `.env.example`):

```env
# Database
DATABASE_URL=postgresql://knowledgebase_user:knowledgebase_pass@localhost:5432/knowledgebase

# LLM Providers (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...

# Authentication
JWT_SECRET=your-super-secret-key-change-in-production

# OAuth for User Login (Google/GitHub)
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3001/api/oauth/auth/google/callback
GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3001/api/oauth/auth/github/callback
FRONTEND_URL=http://localhost:3000

# OAuth for Email Integration (Gmail/Outlook)
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REDIRECT_URI=http://localhost:3001/api/email/auth/gmail/callback
OUTLOOK_CLIENT_ID=...
OUTLOOK_CLIENT_SECRET=...
OUTLOOK_REDIRECT_URI=http://localhost:3001/api/email/auth/outlook/callback

# Encryption (auto-generated if not provided)
ENCRYPTION_KEY=base64-encoded-32-byte-key

# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=debug
```

## CI/CD Pipeline

GitHub Actions workflows:

- **`pr-validation.yml`**: Runs on all PRs
  - Type checking (TypeScript)
  - Linting (ESLint)
  - Tests with coverage
  - Build verification

- **`ci.yml`**: Runs on pushes to main/master and daily at 3 AM
  - Multi-version testing (Node 18.x, 20.x)
  - Security audit (`npm audit`)
  - Dependency checks

- **`deploy.yml`**: Manual deployment workflow
  - Environment selection (staging/production)
  - Pre-deployment validation
  - Post-deployment health checks

## Code Quality Standards

All code must pass:
- TypeScript compilation with strict mode
- ESLint with zero errors
- All tests passing
- Successful build for both backend and frontend

## Important Patterns

### Authentication Flow

**Standard Email/Password Auth:**
1. User registers/logs in via `/api/auth/register` or `/api/auth/login`
2. Backend returns JWT token
3. Frontend stores token in memory (AuthContext)
4. Token included in Authorization header: `Bearer <token>`
5. Backend middleware validates token for protected routes

**OAuth Login (Google/GitHub):**
1. User clicks "Google" or "GitHub" button on login page
2. Frontend redirects to `/api/oauth/auth/{provider}`
3. Backend initiates OAuth flow with provider
4. User completes OAuth on provider's site
5. Provider redirects to `/api/oauth/auth/{provider}/callback`
6. Backend creates/updates user, generates JWT token
7. Redirects to `/oauth/callback?token={jwt}` on frontend
8. Frontend stores token and redirects to dashboard

**Email Integration OAuth (Gmail/Outlook):**
1. Logged-in user clicks "Connect Gmail/Outlook" in dashboard
2. Frontend calls `/api/email/auth/{provider}` to get auth URL
3. Opens auth URL in popup window
4. User completes OAuth on provider's site
5. Provider redirects to `/api/email/auth/{provider}/callback`
6. Backend stores encrypted credentials in database
7. Redirects to `/auth/email/callback?code=success&provider={provider}`
8. Frontend callback page sends message to parent window
9. Parent window (dashboard) receives success and refreshes status

**For detailed OAuth setup instructions, see `docs/oauth-setup.md`**

### RAG (Retrieval-Augmented Generation) Pattern

1. User uploads knowledge (documents, manual entries) or emails are synced
2. Content is embedded using OpenAI embeddings API (1536 dimensions)
3. Embeddings stored in PostgreSQL with pgvector extension
4. During chat, relevant context retrieved via:
   - **Hybrid Search**: Combines vector similarity (semantic) + BM25 (keyword)
   - **Reranking**: Orders results by relevance score
   - **Diversity Filtering**: Removes similar/redundant results
5. Top results (configurable, default 5) added to LLM context
6. Similarity thresholds configurable per knowledge base:
   - Knowledge base entries: default 0.70
   - Email messages: default 0.65
7. Advanced features:
   - Temporal decay for time-sensitive content
   - MMR (Maximal Marginal Relevance) for diverse answers
   - Semantic boost for highly relevant terms
   - Configurable max results ratio per source type

## Common Gotchas

## Resources

- **Project Documentation**: See `docs/` directory.
- **Setup Guide**: `docs/setup/guide.md`
- **OAuth Setup**: `docs/oauth-setup.md` - Complete guide for configuring OAuth (Google/GitHub login + Gmail/Outlook integration)
- **RAG Debugging**: `docs/rag/debugging.md`
- **Configuration**: `docs/backend/configuration.md`
- **Database Schema**: `database/migrations/001_initial_schema.sql`
- **Docker Configuration**: `docker-compose.yml`

---

**You're all set!** 🚀
