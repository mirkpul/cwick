// Helper function to format debug logs for console (Docker-friendly)
// Currently unused but kept for potential future structured logging
interface LogInfo {
  timestamp?: string;
  level?: string;
  message: string;
  query?: string;
  resultsCount?: number;
  results?: Array<{
    rank: number;
    title: string;
    similarity: number;
    contentPreview: string;
  }>;
  systemPrompt?: string;
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPromptLength?: number;
  conversationMessages?: Array<{
    role: string;
    contentPreview: string;
  }>;
  fullResponse?: string;
  responseLength?: number;
  usage?: {
    total_tokens?: number;
  };
  finishReason?: string;
  [key: string]: unknown;
}

const _formatDebugLog = (info: LogInfo): string => {
  const { timestamp, level, message, ...meta } = info;

  // For debug logs with large objects, format them nicely
  if (message.includes('===')) {
    // Special formatting for our debug markers
    let output = `\n${timestamp} ${level}: ${message}`;

    // Handle KB query results
    if (meta.results && Array.isArray(meta.results)) {
      output += `\n  Query: "${meta.query}"`;
      output += `\n  Results: ${meta.resultsCount}`;
      meta.results.forEach((r) => {
        output += `\n    ${r.rank}. ${r.title} (similarity: ${r.similarity})`;
        output += `\n       ${r.contentPreview}`;
      });
      return output;
    }

    // Handle system prompt
    if (meta.systemPrompt) {
      output += `\n  Provider: ${meta.provider}`;
      output += `\n  Model: ${meta.model}`;
      output += `\n  Temperature: ${meta.temperature}`;
      output += `\n  Max Tokens: ${meta.maxTokens}`;
      output += `\n  System Prompt Length: ${meta.systemPromptLength} chars`;
      output += `\n  Messages: ${meta.conversationMessages?.length || 0}`;

      // Show first 500 chars of system prompt
      output += `\n  --- System Prompt (first 500 chars) ---`;
      output += `\n  ${meta.systemPrompt.substring(0, 500)}...`;

      // Show conversation messages
      if (meta.conversationMessages && meta.conversationMessages.length > 0) {
        output += `\n  --- Conversation Messages ---`;
        meta.conversationMessages.forEach((m) => {
          output += `\n    [${m.role}]: ${m.contentPreview}`;
        });
      }
      return output;
    }

    // Handle LLM response
    if (meta.fullResponse) {
      output += `\n  Provider: ${meta.provider}`;
      output += `\n  Model: ${meta.model}`;
      output += `\n  Response Length: ${meta.responseLength} chars`;
      output += `\n  Tokens Used: ${meta.usage?.total_tokens || 'N/A'}`;
      output += `\n  Finish Reason: ${meta.finishReason}`;
      output += `\n  --- Full Response ---`;
      output += `\n  ${meta.fullResponse}`;
      return output;
    }

    // Default: show all meta
    if (Object.keys(meta).length > 0) {
      output += `\n  ${JSON.stringify(meta, null, 2)}`;
    }
    return output;
  }

  // Regular logs: keep simple
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${level}: ${message}${metaStr}`;
};

// Suppress unused variable warning
void _formatDebugLog;

type LogMeta = Record<string, unknown> | Error | unknown;

interface Logger {
  debug: (msg: string, meta?: LogMeta) => void;
  info: (msg: string, meta?: LogMeta) => void;
  warn: (msg: string, meta?: LogMeta) => void;
  error: (msg: string, meta?: LogMeta) => void;
}

// Helper to serialize metadata, including Error objects
const serializeMeta = (meta?: LogMeta): string => {
  if (!meta) return '';

  // Handle Error objects specially
  if (meta instanceof Error) {
    // Extract all enumerable and non-enumerable properties from the error
    const errorObj: Record<string, unknown> = {
      name: meta.name,
      message: meta.message,
      stack: meta.stack,
    };

    // Include any additional enumerable properties
    Object.keys(meta).forEach((key) => {
      errorObj[key] = (meta as unknown as Record<string, unknown>)[key];
    });

    return JSON.stringify(errorObj);
  }

  return JSON.stringify(meta);
};

// Simple console logger to ensure visibility
const logger: Logger = {
  debug: (msg: string, meta?: LogMeta): void => {
    console.log(`[DEBUG] ${msg}`, serializeMeta(meta));
  },
  info: (msg: string, meta?: LogMeta): void => {
    console.log(`[INFO] ${msg}`, serializeMeta(meta));
  },
  warn: (msg: string, meta?: LogMeta): void => {
    console.warn(`[WARN] ${msg}`, serializeMeta(meta));
  },
  error: (msg: string, meta?: LogMeta): void => {
    console.error(`[ERROR] ${msg}`, serializeMeta(meta));
  },
};

// Simple LLM logger
export const llmLogger: Logger = {
  info: (msg: string, meta?: LogMeta): void => {
    console.log(`[LLM] ${msg}`, serializeMeta(meta));
  },
  debug: (msg: string, meta?: LogMeta): void => {
    console.log(`[LLM-DEBUG] ${msg}`, serializeMeta(meta));
  },
  warn: (msg: string, meta?: LogMeta): void => {
    console.warn(`[LLM-WARN] ${msg}`, serializeMeta(meta));
  },
  error: (msg: string, meta?: LogMeta): void => {
    console.error(`[LLM-ERROR] ${msg}`, serializeMeta(meta));
  },
};

export default logger;
