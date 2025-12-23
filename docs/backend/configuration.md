# Backend Configuration Guide

This guide explains the global configuration values in `src/config/appConfig.js` (Backend).

## Overview

Configuration priority (Highest to Lowest):
1.  **Database-stored settings** (Twin-specific)
2.  **Environment variables** (`.env`)
3.  **Config defaults** (`appConfig.js`)

## Key Sections

### File Upload
Controls file upload behavior.
```javascript
fileUpload: {
  maxSizeBytes: 100 * 1024 * 1024,  // 100MB
  allowedMimeTypes: ['application/pdf', 'text/plain', ...],
  allowedExtensions: ['.pdf', '.txt', '.md', '.csv']
}
```

### Text Chunking
Controls how documents are split.
```javascript
chunking: {
  maxTokensPerChunk: 500,
  overlapTokens: 50,
}
```

### LLM Settings
Default model params.
```javascript
llm: {
  defaultTemperature: 0.7,
  defaultMaxTokens: 10000,
  providers: {
    openai: { embeddingModel: 'text-embedding-3-small' }
  }
}
```

### Handover
Controls human handover triggers.
```javascript
handover: {
  defaultThreshold: 0.7 
}
```

### Database
Connection pool settings.
```javascript
database: {
  poolMax: 20,
  idleTimeoutMs: 30000,
}
```

## Environment Variables

Required variables in `.env`:
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/virtualcoach
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...
JWT_SECRET=secure-string
PORT=3001
```
