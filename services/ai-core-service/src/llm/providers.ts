import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type {
  GenerateResponseRequest,
  GenerateEmbeddingRequest,
  LLMResponse,
  EmbeddingResponse,
  LLMProvider,
} from '@virtualcoach/shared-types';
import { config } from './config';
import { logger } from './logger';

const OPENAI_UNSUPPORTED_STREAM_ERROR = 'Streaming responses are not supported by LLM Gateway yet';

type ChatResult = {
  response: LLMResponse;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

type EmbedResult = {
  response: EmbeddingResponse;
  usage?: { prompt_tokens?: number; total_tokens?: number };
};

export class OpenAIProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async chat(request: GenerateResponseRequest): Promise<ChatResult> {
    if (request.stream) {
      throw new Error(OPENAI_UNSUPPORTED_STREAM_ERROR);
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = request.messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));

    const response = await this.client.chat.completions.create(
      {
        model: request.model || config.defaultModel,
        messages,
        temperature: request.temperature ?? 1,
        max_tokens: request.maxTokens,
      }
    );

    const choice = response.choices[0];
    return {
      response: {
        content: choice.message?.content || '',
        model: response.model,
        usage: response.usage
          ? {
              prompt_tokens: response.usage.prompt_tokens || 0,
              completion_tokens: response.usage.completion_tokens || 0,
              total_tokens: response.usage.total_tokens || 0,
            }
          : undefined,
        finish_reason: choice.finish_reason || undefined,
      },
      usage: response.usage,
    };
  }

  async embed(request: GenerateEmbeddingRequest): Promise<EmbedResult> {
    const inputs = Array.isArray(request.text) ? request.text : [request.text];

    const response = await this.client.embeddings.create({
      model: request.model || config.defaultEmbeddingModel,
      input: inputs,
    });

    return {
      response: {
        embeddings: response.data.map(item => item.embedding),
        model: response.model,
        usage: response.usage
          ? {
              prompt_tokens: (response.usage as any).prompt_tokens || 0,
              total_tokens: (response.usage as any).total_tokens || 0,
            }
          : undefined,
      },
      usage: response.usage as any,
    };
  }
}

export class AnthropicProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  private getMessagesClient() {
    const messagesClient = (this.client as unknown as { messages?: { create: (params: any) => Promise<any> } }).messages;
    if (!messagesClient || typeof messagesClient.create !== 'function') {
      throw new Error('Anthropic messages client is not available');
    }
    return messagesClient;
  }

  async chat(request: GenerateResponseRequest): Promise<ChatResult> {
    if (request.stream) {
      throw new Error(OPENAI_UNSUPPORTED_STREAM_ERROR);
    }

    const systemPrompt =
      request.messages.find(m => m.role === 'system')?.content || 'You are a helpful assistant.';
    const messages = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    const response = await this.getMessagesClient().create({
      model: request.model || 'claude-3-sonnet-20240229',
      messages,
      system: systemPrompt,
      temperature: request.temperature ?? 1,
      max_tokens: request.maxTokens || 1024,
    });

    const firstText = response.content.find((block: { type: string; text?: string }) => block.type === 'text');
    const content = firstText && firstText.type === 'text' ? firstText.text || '' : '';

    return {
      response: {
        content,
        model: response.model,
        usage: response.usage
          ? {
              prompt_tokens: (response.usage as any).input_tokens || 0,
              completion_tokens: (response.usage as any).output_tokens || 0,
              total_tokens:
                ((response.usage as any).input_tokens || 0) + ((response.usage as any).output_tokens || 0),
            }
          : undefined,
        finish_reason: (response as any).stop_reason,
      },
      usage: response.usage as any,
    };
  }

  async embed(): Promise<EmbedResult> {
    throw new Error('Embeddings are not supported for Anthropic provider');
  }
}

export function resolveProvider(provider: LLMProvider, openaiApiKey?: string, anthropicApiKey?: string) {
  switch (provider) {
    case 'openai':
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
      }
      return new OpenAIProvider(openaiApiKey);
    case 'anthropic':
      if (!anthropicApiKey) {
        throw new Error('ANTHROPIC_API_KEY is not configured');
      }
      return new AnthropicProvider(anthropicApiKey);
    default:
      logger.error('Unsupported provider requested', { provider });
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
