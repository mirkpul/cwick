# RAG Configuration Guide

This document provides practical configuration examples for the RAG (Retrieval-Augmented Generation) system.

## Configuration File

The main configuration is located in `src/config/appConfig.js`.

## Scenarios

### 1. Email-Heavy Use Case
**Goal**: Prioritize emails, use KB as effective backup.

```javascript
semanticSearch: {
  defaultThreshold: 0.70,
  defaultMaxResults: 5,
  sourceThresholds: {
    email: 0.60,           // Lower threshold - include more emails
    knowledgeBase: 0.75,   // Higher threshold - be selective with KB
  },
  ensembleBalancing: {
    enabled: true,
    minEmailResults: 2,    // Ensure at least 2 emails
    minKBResults: 0,
    maxEmailRatio: 0.8,
    maxKBRatio: 0.4,
  },
}
```

### 2. Knowledge Base Focus
**Goal**: Consultant with comprehensive docs, emails are secondary.

```javascript
semanticSearch: {
  defaultThreshold: 0.70,
  defaultMaxResults: 5,
  sourceThresholds: {
    email: 0.75,           // Higher threshold - only high-quality emails
    knowledgeBase: 0.65,   // Lower threshold - more KB content
  },
  ensembleBalancing: {
    enabled: true,
    minEmailResults: 0,
    minKBResults: 2,       // Ensure at least 2 KB entries
    maxEmailRatio: 0.3,
    maxKBRatio: 0.9,
  },
}
```

### 3. Strict Quality Control
**Goal**: Legal/Medical use case - high relevance required.

```javascript
semanticSearch: {
  defaultThreshold: 0.80,
  defaultMaxResults: 3,
  sourceThresholds: {
    email: 0.80,
    knowledgeBase: 0.85,
  },
  ensembleBalancing: {
    enabled: false,        // Pure quality-based selection
  },
}
```

### 4. Development/Testing
**Goal**: See all matches for debugging.

```javascript
semanticSearch: {
  defaultThreshold: 0.50,
  defaultMaxResults: 10,
  sourceThresholds: {
    email: 0.40,
    knowledgeBase: 0.45,
  },
  ensembleBalancing: {
    enabled: false,
  },
}
```

## Dynamic Thresholds

You can implement adaptive thresholds in `chatService.js` based on available data:

```javascript
async _performEnhancedRAGSearch(conversation, userQuery, conversationHistory) {
  const kbCount = await this.getKnowledgeBaseCount(conversation.twin_id);
  
  // Adjust threshold if KB is small
  const threshold = kbCount < 10 
    ? 0.60 
    : config.semanticSearch.defaultThreshold;
    
  // ...
}
```

## A/B Testing

Use feature flags or environment variables to test configurations:

```javascript
const EXPERIMENT_GROUP = process.env.EXPERIMENT_GROUP || 'A';

const semanticSearchConfig = EXPERIMENT_GROUP === 'B' ? {
  // Group B: Aggressive email inclusion
  sourceThresholds: { email: 0.60, knowledgeBase: 0.70 },
} : {
  // Group A: Conservative (Control)
  sourceThresholds: { email: 0.65, knowledgeBase: 0.70 },
};
```
