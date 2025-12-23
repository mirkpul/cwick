# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Digital Twin SAAS Platform - A comprehensive platform for professionals to create and manage AI-powered digital twins. The system enables professionals to create conversational AI agents powered by OpenAI (GPT-4) or Anthropic (Claude) that can handle Q&A, consultations, scheduling, and seamlessly handover to humans when needed.

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
docker exec -it digitaltwin-db psql -U digitaltwin_user -d digitaltwin
```

### Database Commands

```bash
# Run migrations manually
psql -U digitaltwin_user -d digitaltwin -f database/migrations/001_initial_schema.sql
psql -U digitaltwin_user -d digitaltwin -f database/migrations/002_email_knowledge_base.sql

# Access database in Docker
docker exec -it digitaltwin-db psql -U digitaltwin_user -d digitaltwin
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
  - `authRoutes.ts`: Authentication (register, login)
  - `digitalTwinRoutes.ts`: Twin CRUD, knowledge base management
  - `chatRoutes.ts`: Conversations, messages, handovers
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
- `users`: Professionals and super admins (role: 'super_admin' | 'professional')
- `digital_twins`: AI twin configurations (one per user)
- `knowledge_base`: FAQ entries with vector embeddings for semantic search
- `email_knowledge`: Imported emails with embeddings (from Gmail/Outlook/IMAP)
- `email_credentials`: Encrypted OAuth tokens and IMAP credentials
- `end_users`: People who chat with digital twins
- `conversations`: Chat sessions with status tracking (active, handed_over, closed)
- `messages`: Individual messages (sender: 'user' | 'twin' | 'professional')
- `handover_notifications`: Notifications when AI needs human takeover

**Key Features**:
- Vector embeddings (1536 dimensions) using OpenAI's text-embedding-3-small
- Semantic search threshold configurable per twin (default 0.80)
- Email sync history tracking
- Automatic email count enforcement per subscription tier

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
- `professional_takeover`: Professional takes over from AI

### LLM Integration

Supports multiple providers with unified interface:

- **OpenAI**: GPT-4, GPT-3.5
- **Anthropic**: Claude 3 (Opus, Sonnet, Haiku)

Configuration stored per digital twin: `llm_provider`, `llm_model`, `temperature`, `max_tokens`, `system_prompt`

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
DATABASE_URL=postgresql://digitaltwin_user:digitaltwin_pass@localhost:5432/digitaltwin

# LLM Providers (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

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

### Semantic Search Pattern

1. User uploads knowledge or emails are synced
2. Content is embedded using OpenAI embeddings API (1536 dimensions)
3. Embedding stored in PostgreSQL with pgvector
4. During chat, relevant context retrieved via vector similarity search
5. Top results (configurable, default 3) added to LLM context
6. Similarity threshold configurable per twin (default 0.80)

### Handover Flow

1. AI twin detects low confidence or explicit user request
2. `handover_notifications` record created
3. WebSocket notification sent to professional
4. Conversation status updated to 'handed_over'
5. Professional can respond via chat interface
6. Messages from professional sent with sender='professional'

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
