# Backend Configuration Guide

## Overview

The RAG Knowledge Base SAAS Platform uses a layered configuration approach:

1. **Environment Variables** (`.env`) - Runtime configuration (API keys, secrets, URLs)
2. **Application Config** (`src/config/appConfig.ts`) - Business logic defaults (RAG settings, chunking, thresholds)
3. **Database Settings** - Per-knowledge base overrides (LLM provider, temperature, system prompt)

This document covers both environment variables and application configuration.

---

## Environment Variables

### Required Variables

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

#### Core Requirements

```bash
# Database
DATABASE_URL=postgresql://digitaltwin_user:digitaltwin_pass@localhost:5432/digitaltwin

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production  # Min 32 chars
ENCRYPTION_KEY=your-encryption-key-min-32-characters        # Min 32 chars

# LLM Provider (at least one required)
OPENAI_API_KEY=sk-your-openai-api-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key
GEMINI_API_KEY=your-gemini-api-key

# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

### Optional Features

#### OAuth User Login

```bash
# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3001/api/oauth/auth/google/callback

# GitHub OAuth
GITHUB_OAUTH_CLIENT_ID=your-client-id
GITHUB_OAUTH_CLIENT_SECRET=your-client-secret
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3001/api/oauth/auth/github/callback
```

#### Email Integration (Gmail/Outlook)

```bash
# Gmail
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REDIRECT_URI=http://localhost:3001/api/email/auth/gmail/callback

# Outlook
OUTLOOK_CLIENT_ID=your-client-id
OUTLOOK_CLIENT_SECRET=your-client-secret
OUTLOOK_REDIRECT_URI=http://localhost:3001/api/email/auth/outlook/callback
```

#### Web Scraping

```bash
WEB_SCRAPING_REDIS_URL=redis://localhost:6379
SCRAPER_ENABLE_SCREENSHOTS=false
```

#### Logging

```bash
LOG_LEVEL=debug  # debug | info | warn | error
RAG_LOG_VERBOSE=false  # Enable detailed RAG pipeline logging
```

### Production-Specific

```bash
# Production settings
NODE_ENV=production
LOG_LEVEL=info
CORS_ORIGIN=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Use HTTPS for OAuth callbacks
GOOGLE_OAUTH_REDIRECT_URI=https://yourdomain.com/api/oauth/auth/google/callback
GMAIL_REDIRECT_URI=https://yourdomain.com/api/email/auth/gmail/callback
```

### Validation

Use the validation script to check your `.env`:

```bash
# Validate development environment
node scripts/validate-env.js

# Validate production environment
node scripts/validate-env.js --env=production
```

---

## Application Configuration

Located in `backend/src/config/appConfig.ts`. These are code-level defaults that apply globally unless overridden.

### File Upload

```typescript
fileUpload: {
  maxSizeBytes: 100 * 1024 * 1024,  // 100MB maximum
  maxSizeMB: 100,
  allowedMimeTypes: [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',  // PPTX
    'image/png',
    'image/jpeg',
  ],
  allowedExtensions: ['.pdf', '.txt', '.md', '.csv', '.png', '.jpg', '.pptx'],
}
```

### Chunking Strategies

#### Semantic Chunking (Recommended)

```typescript
semanticChunking: {
  enabled: true,
  maxTokensPerChunk: 550,       // Larger chunks for richer context
  minChunkSize: 50,             // Minimum tokens to avoid tiny chunks
  overlapPercentage: 0.15,      // 15% overlap
  similarityThreshold: 0.78,    // Topic boundary detection (cosine similarity)
  charactersPerToken: 4,
  fallbackToCharBased: true,    // Use character-based if semantic fails
  maxDocumentTokens: 6000,      // Max doc size for semantic chunking
}
```

#### Character-Based Chunking (Legacy)

```typescript
chunking: {
  maxTokensPerChunk: 700,
  overlapTokens: 40,
  charactersPerToken: 4,
}
```

### LLM Configuration

```typescript
llm: {
  defaultTemperature: 0.7,      // Creativity (0-2)
  defaultMaxTokens: 10000,      // Max response length
  providers: {
    openai: {
      embeddingModel: 'text-embedding-3-small',  // Upgraded from ada-002
      embeddingDimensions: 1536,
      legacyEmbeddingModel: 'text-embedding-ada-002',
    },
  },
}
```

### Semantic Search

```typescript
semanticSearch: {
  defaultThreshold: 0.20,       // 20% default similarity threshold
  defaultMaxResults: 5,         // Results to include in LLM context
  internalSearchLimit: 20,      // Fetch more, then filter

  // Adaptive filtering for score compression
  useAdaptiveFiltering: true,
  topScoreGapPercent: 0.05,     // Keep results within 5% of top score
  useNormalization: true,
  minStdDevAboveMean: 0.5,

  // Source-specific thresholds
  sourceThresholds: {
    email: 0.50,                // 50% for emails
    knowledgeBase: 0.20,        // 20% for KB entries
  },

  // Ensemble balancing (email + KB mix)
  ensembleBalancing: {
    enabled: true,
    minEmailResults: 1,
    minKBResults: 1,
    maxEmailRatio: 0.2,         // Max 20% emails
    maxKBRatio: 0.8,            // Max 80% KB
  },
}
```

### RAG Optimization

#### Document Preprocessing

```typescript
documentPreprocessing: {
  enabled: true,
  removeHeaders: true,          // Strip email headers/footers
  removeFooters: true,
  normalizeWhitespace: true,
  removeUrls: true,
  maxChunkLength: 6000,
}
```

#### Contextual Enrichment

```typescript
contextualEnrichment: {
  enabled: true,
  useContextGeneration: true,   // Use LLM to add context to chunks
  contextPromptTemplate: `...`,
  maxContextLength: 200,
  cacheContexts: true,          // Use prompt caching
}
```

#### Query Enhancement

```typescript
queryEnhancement: {
  enabled: true,
  useHyDE: false,               // Disabled for cost optimization
  useMultiQuery: false,         // Disabled for cost optimization
  useConversationContext: true, // Essential for multi-turn chat
  maxContextMessages: 3,
}
```

#### Hybrid Search (Vector + BM25)

```typescript
hybridSearch: {
  enabled: true,
  vectorWeight: 0.6,            // 60% vector similarity
  bm25Weight: 0.4,              // 40% keyword matching
  fusionMethod: 'weighted',     // 'rrf' | 'weighted' | 'score-based'
  bm25K1: 1.5,                  // Term frequency saturation
  bm25B: 0.75,                  // Length normalization
  topKPerMethod: 20,
  finalTopK: 10,
}
```

#### Reranking

```typescript
reranking: {
  enabled: true,
  method: 'cross-encoder',      // 'cross-encoder' | 'llm' | 'semantic'
  topK: 20,
  finalK: 5,

  // Diversity filtering
  useDiversityFilter: true,
  diversityThreshold: 0.85,     // Exclude if >85% similar to selected

  // MMR (Maximal Marginal Relevance)
  useMMR: false,
  mmrLambda: 0.7,               // 0.7 relevance, 0.3 diversity

  // Semantic boost
  semanticBoost: {
    enabled: true,
    maxBoost: 0.05,             // Max 5% boost
    minThreshold: 0.30,
  },
}
```

#### Performance

```typescript
performance: {
  useBatchEmbeddings: true,
  maxBatchSize: 100,
  maxBatchTokens: 6000,
  usePromptCaching: true,
  parallelQueries: true,
}
```

### Database

```typescript
database: {
  poolMax: 20,                  // Max connections
  idleTimeoutMs: 30000,         // Idle connection timeout
  connectionTimeoutMs: 2000,    // Connection timeout
}
```

---

## Per-Knowledge Base Settings

These are stored in the `knowledge_bases` table and override defaults:

- **LLM Provider**: `openai`, `anthropic`, `gemini`
- **LLM Model**: `gpt-4`, `gpt-3.5-turbo`, `claude-3-opus-20240229`, etc.
- **Temperature**: `0.0` - `2.0`
- **Max Tokens**: `1` - `100000`
- **System Prompt**: Custom instructions for the AI
- **Search Threshold**: Per-KB semantic search threshold
- **Max Results**: Number of context results

These can be configured via the dashboard or API.

---

## Configuration Priority

When a setting exists in multiple places:

1. **Database** (per-knowledge base) - Highest priority
2. **Environment Variables** (`.env`)
3. **Application Config** (`appConfig.ts`) - Lowest priority (defaults)

Example: If a knowledge base has `temperature: 0.3` in the database, it will override `llm.defaultTemperature: 0.7` from `appConfig.ts`.

---

## Common Scenarios

### Development Mode

```bash
NODE_ENV=development
LOG_LEVEL=debug
RAG_LOG_VERBOSE=true
```

### Production Mode

```bash
NODE_ENV=production
LOG_LEVEL=info
RAG_LOG_VERBOSE=false
CORS_ORIGIN=https://yourdomain.com
```

### Cost Optimization

In `appConfig.ts`:

```typescript
queryEnhancement: {
  useHyDE: false,              // Save 1 LLM call + 1 embedding per query
  useMultiQuery: false,        // Save 1 LLM call + 3 embeddings per query
  useConversationContext: true, // Keep enabled (essential)
}
```

### High-Quality RAG

In `appConfig.ts`:

```typescript
semanticSearch: {
  defaultThreshold: 0.80,      // Stricter threshold
  sourceThresholds: {
    email: 0.80,
    knowledgeBase: 0.85,
  },
}

reranking: {
  useDiversityFilter: true,
  useMMR: true,                // Enable MMR for diverse results
}
```

---

## Troubleshooting

### "No LLM provider configured"

Ensure at least one of these is set in `.env`:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`

### "Invalid JWT secret"

Ensure `JWT_SECRET` is at least 32 characters in production.

### "Database connection failed"

Check `DATABASE_URL` format:
```
postgresql://username:password@host:port/database
```

### "OAuth redirect mismatch"

Ensure OAuth redirect URIs match exactly:
- In `.env`: `http://localhost:3001/api/oauth/auth/google/callback`
- In Google Console: `http://localhost:3001/api/oauth/auth/google/callback`

---

## Related Documentation

- [.env.example](./.env.example) - Environment variable template
- [OAuth Setup Guide](../oauth-setup.md) - OAuth configuration
- [RAG Configuration](../rag/configuration.md) - RAG tuning examples
- [Production Checklist](../../PRODUCTION_CHECKLIST.md) - Deployment guide
