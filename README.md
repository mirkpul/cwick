# RAG Knowledge Base SAAS Platform

> **Version 1.0.0** - Production-Ready AI Knowledge Base Platform

A comprehensive SAAS platform for professionals to create and manage AI-powered knowledge bases with advanced RAG (Retrieval-Augmented Generation) capabilities. Create conversational AI agents powered by OpenAI (GPT-4), Anthropic (Claude), or Google (Gemini) that can handle Q&A, consultations, and leverage uploaded documents, emails, and web scraping for contextual responses.

[![Tests](https://img.shields.io/badge/tests-424%20passing-success)](./TEST_COVERAGE_PLAN.md)
[![Coverage](https://img.shields.io/badge/coverage-49%25-yellow)](./TEST_COVERAGE_PLAN.md)
[![TypeScript](https://img.shields.io/badge/typescript-100%25-blue)](./tsconfig.json)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

## ✨ Key Features

### 🤖 Multi-Provider LLM Support
- **OpenAI**: GPT-4, GPT-3.5 Turbo
- **Anthropic**: Claude 3 (Opus, Sonnet, Haiku), Claude 3.5 Sonnet
- **Google**: Gemini Pro, Gemini Pro Vision

### 🧠 Advanced RAG Engine
- **Hybrid Search**: Vector similarity + BM25 keyword search
- **Query Enhancement**: HyDE, multi-query expansion, context injection
- **Reranking**: Semantic boost, diversity filtering, MMR (Maximal Marginal Relevance)
- **Ensemble Balancing**: Adaptive weight calculation based on query type
- **Temporal Decay**: Time-based relevance scoring for email results
- **Configurable Thresholds**: Per-source similarity thresholds (KB, Email)

### 📚 Multi-Source Knowledge Integration
- **Document Upload**: PDF, TXT, MD, CSV, DOCX, PPTX with advanced extraction
- **Email Sync**: Gmail, Outlook, IMAP with OAuth2 and encryption
- **Web Scraping**: Scheduled URL monitoring with BullMQ and optional screenshots
- **Manual Entries**: Direct FAQ and knowledge base management

### 🔐 Authentication & Security
- **JWT Authentication**: Secure token-based auth
- **OAuth 2.0**: Google and GitHub login support
- **Data Encryption**: AES-256-GCM for sensitive data
- **Sensitive Data Detection**: Automatic redaction of PII, credit cards, SSNs

### 💬 Real-time Chat
- **WebSocket**: Real-time bidirectional communication
- **Streaming Responses**: Token-by-token LLM output
- **Conversation History**: Contextual multi-turn conversations
- **Context Preview**: Inspect what the AI sees before responding

### 📊 Analytics & Monitoring
- **RAG Logging**: Detailed retrieval and ranking metrics
- **Token Usage Tracking**: Monitor LLM costs and consumption
- **Conversation Analytics**: Track engagement and performance
- **Benchmark Tools**: Dataset creation and model comparison

## 🚀 Quick Start

### Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/cwick.git
cd cwick

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
nano .env  # or your preferred editor

# Start all services
docker-compose up --build
```

Access the application at [http://localhost:3000](http://localhost:3000)

### Manual Setup

#### Prerequisites
- Node.js 18+ or 20+
- PostgreSQL 14+ with pgvector extension
- Redis (for web scraping)

#### Backend Setup

```bash
cd backend
npm install

# Set up database
psql -U postgres -f database/init_db.sql

# Run migrations
psql -U digitaltwin_user -d digitaltwin -f database/migrations/001_initial_schema.sql

# Start development server
npm run dev
```

#### Frontend Setup

```bash
cd frontend
npm install

# Start development server
npm run dev
```

## 📚 Documentation

### 🎯 Getting Started
- **[Setup & Quick Start Guide](docs/setup/guide.md)** - Complete installation guide
- **[OAuth Setup](docs/oauth-setup.md)** - Configure Google/GitHub authentication
- **[Configuration Guide](docs/backend/configuration.md)** - Backend configuration options

### 🧠 RAG Engine
- **[RAG Optimizations](docs/rag/optimizations.md)** - Advanced scoring and cost optimizations
- **[RAG Configuration](docs/rag/configuration.md)** - Configuration examples for different use cases
- **[Debugging Guide](docs/rag/debugging.md)** - Troubleshoot RAG pipelines and search quality
- **[Changelog](docs/rag/changelog.md)** - Recent improvements to the AI engine

### 🛠️ API & Technical
- **[File Upload API](docs/backend/api-file-upload.md)** - Knowledge base management API
- **[LLM Logging](docs/backend/llm-logging.md)** - Interaction logging system
- **[Web Scraping](docs/backend/web-scraping.md)** - Configure website sources and scheduler
- **[Frontend Components](docs/frontend/knowledge-base.md)** - UI components guide

### 👥 Contributing
- **[Contributing Guide](docs/contributing.md)** - How to contribute to the project
- **[CLAUDE.md](CLAUDE.md)** - Development guide for AI assistants

## 🏗️ Architecture

### Tech Stack

**Backend**
- Node.js + Express + TypeScript
- PostgreSQL 14+ with pgvector extension
- WebSocket (ws) for real-time communication
- OpenAI, Anthropic, Google AI SDKs

**Frontend**
- React 18
- Vite (build tool)
- TypeScript
- Tailwind CSS

**Infrastructure**
- Docker + Docker Compose
- Nginx (reverse proxy)
- BullMQ (job queue for scraping)
- Redis (queue backend)

### Project Structure

```
cwick/
├── backend/                 # Node.js + Express API
│   ├── src/
│   │   ├── config/         # Configuration and app setup
│   │   ├── controllers/    # Route controllers
│   │   ├── middleware/     # Auth, validation, rate limiting
│   │   ├── routes/         # API route definitions
│   │   ├── services/       # Business logic
│   │   │   ├── llmService.ts              # LLM provider abstraction
│   │   │   ├── chatService.ts             # Conversation management
│   │   │   ├── fileProcessingService.ts   # Document processing
│   │   │   ├── queryEnhancementService.ts # Query optimization
│   │   │   ├── hybridSearchService.ts     # Vector + BM25 fusion
│   │   │   ├── rerankingService.ts        # Result reranking
│   │   │   └── ...
│   │   └── types/          # TypeScript definitions
│   └── dist/               # Compiled JavaScript
├── frontend/                # React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── context/        # React Context providers
│   │   ├── pages/          # Route pages
│   │   └── services/       # API client
│   └── dist/               # Production build
├── database/
│   ├── init_db.sql         # Database initialization
│   ├── migrations/         # SQL migrations
│   └── scripts/            # Management scripts
├── docs/                    # Documentation
└── services/                # Additional services (web scraping)
```

## 🧪 Testing

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Type check
npm run type-check

# Lint
npm run lint
```

**Current Coverage**: 49% (424 tests passing)
- Core RAG services: 90%+ coverage
- Authentication: 100% coverage
- Controllers: 62.75% coverage

### Frontend Tests

```bash
cd frontend

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 🔧 Configuration

### Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://digitaltwin_user:digitaltwin_pass@localhost:5432/digitaltwin

# LLM Providers (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...

# Authentication
JWT_SECRET=your-super-secret-key-change-in-production

# OAuth (optional)
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...

# Server
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
```

See [`.env.example`](.env.example) for the complete list.

## 📦 Deployment

### Docker Production Build

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

### Environment-Specific Configuration

- **Development**: Uses `.env` and hot-reload
- **Staging**: Use `.env.staging` for pre-production testing
- **Production**: Use `.env.production` with secure secrets management

## 🔍 Key Workflows

### Creating a Knowledge Base

1. **Sign up / Login** (Email/Password or OAuth)
2. **Create Knowledge Base** - Configure name, LLM provider, model settings
3. **Add Knowledge**:
   - Upload documents (PDF, DOCX, etc.)
   - Connect email (Gmail/Outlook/IMAP)
   - Add web scraping sources
   - Create manual FAQ entries
4. **Configure RAG Settings** - Adjust thresholds, reranking, diversity
5. **Test in Chat** - Verify responses and context

### OAuth Authentication Flow

1. User clicks "Login with Google/GitHub"
2. Backend redirects to OAuth provider
3. User authorizes application
4. Provider redirects back with auth code
5. Backend exchanges code for token
6. JWT issued to frontend
7. User authenticated

### Email Integration

1. Navigate to Email Settings
2. Click "Connect Gmail" or "Connect Outlook"
3. OAuth flow authorizes email access
4. Backend stores encrypted OAuth tokens
5. Initial sync fetches emails (configurable months)
6. Emails embedded and indexed
7. Available in AI conversations

## 📊 Performance

- **Embedding Speed**: ~100-500 chunks/second (OpenAI)
- **Search Latency**: <100ms for semantic search
- **Response Time**: 1-3s for GPT-4, <1s for Claude Haiku
- **Concurrent Users**: Tested up to 100 concurrent conversations

## 🛣️ Roadmap

### v1.1 (Q1 2025)
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] API rate limiting improvements
- [ ] Webhook integrations

### v1.2 (Q2 2025)
- [ ] Fine-tuning support
- [ ] Custom embedding models
- [ ] Slack/Discord integrations
- [ ] Mobile app (React Native)

### v2.0 (Q3 2025)
- [ ] Multi-tenant architecture
- [ ] White-label customization
- [ ] Enterprise SSO
- [ ] Advanced role-based access control

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](docs/contributing.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test` (both backend and frontend)
5. Commit with clear messages
6. Push to your fork
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for GPT models and embeddings API
- Anthropic for Claude models
- Google for Gemini models
- The open-source community for amazing tools and libraries

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/yourusername/cwick/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/cwick/discussions)

---

**Made with ❤️ by the Virtual Coach Team**

*RAG Knowledge Base SAAS Platform - Empowering professionals with AI-powered knowledge management*
