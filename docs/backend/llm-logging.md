# LLM Interaction Logging

## Overview
The system logs all LLM prompts and responses to `backend/logs/llm-interactions.log` for debugging hallucinations and auditing system prompts.

## Log Format

### Prompt Log
```json
{
  "type": "llm_prompt",
  "conversationId": "conv-123",
  "systemPrompt": "# CRITICAL INSTRUCTIONS...",
  "messageCount": 3
}
```

### Response Log
```json
{
  "type": "llm_response",
  "conversationId": "conv-123",
  "response": "Answer...",
  "tokensUsed": 450
}
```

## Debugging Hallucinations

1.  **Identify Conversation ID**.
2.  **grep Logs**: `grep "conv-123" backend/logs/llm-interactions.log`.
3.  **Check Prompt**: Verify `systemPrompt` actually contained the knowledge base info.
4.  **Check Response**: See if LLM ignored instructions.

## Monitoring

**Watch logs in real-time**:
```bash
tail -f backend/logs/llm-interactions.log | jq .
```

**Count Tokens Used**:
```bash
grep "total_tokens" backend/logs/llm-interactions.log
```
