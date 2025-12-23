# RAG Pipeline Debugging Guide

This guide helps you debug issues with the RAG (Retrieval-Augmented Generation) chat system using structured logging and effective debugging strategies.

## Enabling Debug Logging

### Method 1: Environment Variable (Recommended)

```bash
# In .env file
LOG_LEVEL=debug

# Or export before running
export LOG_LEVEL=debug
npm run dev
```

### Method 2: Logger Configuration

Modify `src/config/logger.js`:

```javascript
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',  // Change from 'info' to 'debug'
  // ...
});
```

## RAG Pipeline Flow

```
User Query
    ↓
1. Query Enhancement (HyDE, Multi-Query, Context Injection)
    ↓
2. Vector Search (KB + Emails)
    ↓
3. BM25 Search (if hybrid enabled)
    ↓
4. Hybrid Fusion (RRF or Weighted)
    ↓
5. Reranking (Diversity + MMR)
    ↓
6. Ensemble Balancing (Source thresholds + ratio limits)
    ↓
7. LLM Context Assembly
    ↓
8. LLM Response Generation
    ↓
Answer to User
```

## Reading the Logs

RAG search processes produce color-coded logs in sequence:

1.  **Search Start** - Blue box with query and config
2.  **Query Enhancement** - Magenta section showing enhanced queries
3.  **Search Results** - Yellow sections for Vector/BM25 results
4.  **Hybrid Fusion** - Cyan section showing fusion results
5.  **Reranking** - Green section showing final reranked results
6.  **LLM Context** - Magenta box showing what's sent to LLM
7.  **LLM Response** - Green section with response metadata
8.  **Search Complete** - Green box with final summary

### Log Examples

#### Knowledge Base Query Results
Triggered when a semantic search is performed.
```json
{
  "level": "debug",
  "message": "=== KNOWLEDGE BASE QUERY RESULTS ===",
  "resultsCounts": 3,
  "results": [
    {
      "rank": 1,
      "title": "Support Info",
      "similarity": "0.9234",
      "contentPreview": "To contact support...",
      "fileName": "support.pdf"
    }
  ]
}
```

#### Complete Prompt to LLM
Triggered before calling the LLM.
```json
{
  "level": "debug",
  "message": "=== COMPLETE PROMPT TO LLM ===",
  "systemPrompt": "## CRITICAL - ANTI-HALLUCINATION INSTRUCTIONS...",
  "conversationMessages": [...]
}
```

## Common Issues & Troubleshooting

### Issue 1: No Results Returned

**Symptoms**: `Final Results: 0 (0 emails, 0 KB)`

**Debugging Steps**:
1.  **Check Vector Search Results**: If 0 total, check if KB/emails exist in DB.
2.  **Check Thresholds**: Look for `[DEBUG] Source-specific thresholds applied`. If `afterCount` is 0, your thresholds (e.g., 0.70) might be too strict. Lower them in `appConfig.js`.
3.  **Check Ensemble Balancing**: If `kbSelected` is 0, check `minKBResults` config.

### Issue 2: Only One Source Type (Email or KB)

**Symptoms**: `Final Results: 5 (5 emails, 0 KB)`

**Debugging Steps**:
1.  **Check Initial Results**: Did both sources return candidates?
2.  **Check Thresholds**: Is `kbThreshold` (e.g., 0.70) significantly higher than `emailThreshold` (e.g., 0.65)?
3.  **Check Balancing**: Verify `ensembleBalancing` is enabled and configured correctly.

### Issue 3: Low-Quality Results

**Symptoms**: All results have yellow/red scores (<70%).

**Debugging Steps**:
1.  **Check Query Enhancement**: Is HyDE generating helpful hypothetical documents?
2.  **Check Hybrid Fusion**: Are Vector and BM25 results consistent?
3.  **Check Reranking**: Try disabling Diversity/MMR to see if raw results are better.

### Issue 4: Hallucinations

**Symptoms**: LLM provides info not in the retrieved context.

**Debugging Steps**:
1.  **Check LLM Context Log**: Does the `systemPrompt` actually contain the relevant chunks?
2.  **Check System Prompt**: Verify anti-hallucination instructions in `contextService.js`.

### Issue 5: Slow Response Times

**Symptoms**: `Time: 3420ms`

**Debugging Steps**:
1.  **Identify Bottleneck**: Check timestamps between log stages.
2.  **Optimization**: Disable HyDE (saves ~500ms) or Multi-Query (saves ~300ms). Reduce `queryVariants` count.

## Log Analysis Commands

**Filter for KB Queries**:
```bash
tail -f logs/app.log | grep "KNOWLEDGE BASE QUERY"
```

**Filter for Prompts**:
```bash
tail -f logs/app.log | grep "COMPLETE PROMPT TO LLM"
```

**Find Low-Score Results**:
```bash
cat app.log | grep -E "[0-9]+% \(.*\)" | awk '$1 < 70 {count++} END {print count}'
```

**Track Average Response Time**:
```bash
cat app.log | grep "Time:" | awk '{sum+=$1; count++} END {print sum/count "ms"}'
```
