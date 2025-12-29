import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../config/logger';
import config from '../config/appConfig';

export type LLMProvider = 'openai' | 'anthropic' | 'gemini';

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
    sender?: 'user' | 'bot'; // Legacy support for 'sender' field
}

export interface LLMResponse {
    content: string;
    metadata: Record<string, unknown>;
}

export interface DescribeImageFromBufferOptions {
    buffer: Buffer;
    mimeType: string;
    prompt: string;
    provider?: LLMProvider;
    model?: string;
    maxTokens?: number;
}

type AnthropicMessage = {
    role: 'user' | 'assistant';
    content: string;
};

interface AnthropicContentBlock {
    type: string;
    text?: string;
}

interface AnthropicMessageResponse {
    model: string;
    usage?: Record<string, unknown>;
    stop_reason?: string;
    content: AnthropicContentBlock[];
}

interface AnthropicStreamEvent {
    type: string;
    delta?: {
        type?: string;
        text?: string;
    };
    stop_reason?: string;
}

type AnthropicMessagesClient = {
    create: (params: Record<string, unknown>) => Promise<unknown>;
};

class LLMService {
    private openai: OpenAI;
    private anthropic: Anthropic;
    private gemini: GoogleGenerativeAI;
    private charactersPerToken: number;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
        this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        this.charactersPerToken = config.chunking.charactersPerToken || 4;
    }

    private getAnthropicMessagesClient(): AnthropicMessagesClient {
        const messagesClient = (this.anthropic as unknown as { messages: AnthropicMessagesClient }).messages;
        if (!messagesClient || typeof messagesClient.create !== 'function') {
            throw new Error('Anthropic messages client is not available');
        }
        return messagesClient;
    }

    async generateResponse(
        provider: LLMProvider,
        model: string,
        messages: LLMMessage[],
        systemPrompt?: string,
        temperature: number | string = config.llm.defaultTemperature,
        maxTokens: number | string = config.llm.defaultMaxTokens
    ): Promise<LLMResponse> {
        const temp = parseFloat(temperature.toString());
        const maxTok = parseInt(maxTokens.toString(), 10);

        // Call provider directly instead of through gateway
        switch (provider) {
            case 'openai':
                return this.generateOpenAIResponse(model, messages, systemPrompt, temp, maxTok);
            case 'anthropic':
                return this.generateAnthropicResponse(model, messages, systemPrompt, temp, maxTok);
            case 'gemini':
                return this.generateGeminiResponse(model, messages, systemPrompt, temp, maxTok);
            default:
                // Fallback to openai
                return this.generateOpenAIResponse(model, messages, systemPrompt, temp, maxTok);
        }
    }

    private async generateOpenAIResponse(
        model: string,
        messages: LLMMessage[],
        systemPrompt: string | undefined,
        temperature: number,
        maxTokens: number
    ): Promise<LLMResponse> {
        const effectiveSystemPrompt = systemPrompt || 'You are a helpful assistant.';
        const formattedMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: effectiveSystemPrompt },
            ...messages.map(msg => ({
                role: (msg.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
                content: msg.content,
            })),
        ];

        const temperaturePayload = this.getOpenAITemperatureParam(model, temperature);
        const appliedTemperature = temperaturePayload.temperature ?? 1;

        logger.debug('OpenAI request', {
            model: model || 'gpt-5-mini',
            messageCount: formattedMessages.length,
            systemPromptLength: effectiveSystemPrompt.length,
            temperature: appliedTemperature,
            maxTokens,
        });

        const response = await this.openai.chat.completions.create({
            model: model || 'gpt-5-mini',
            messages: formattedMessages,
            ...temperaturePayload,
            ...this.getOpenAIMaxTokenParam(model, maxTokens),
        });

        logger.debug('OpenAI response', {
            model: response.model,
            usage: response.usage,
            finishReason: response.choices[0].finish_reason,
            contentLength: response.choices[0].message.content?.length || 0,
        });

        return {
            content: response.choices[0].message.content || '',
            metadata: {
                model: response.model,
                usage: response.usage,
                finish_reason: response.choices[0].finish_reason,
            },
        };
    }

    private async generateAnthropicResponse(
        model: string,
        messages: LLMMessage[],
        systemPrompt: string | undefined,
        temperature: number,
        maxTokens: number
    ): Promise<LLMResponse> {
        const effectiveSystemPrompt = systemPrompt || 'You are a helpful assistant.';
        const formattedMessages: AnthropicMessage[] = messages.map(msg => ({
            role: (msg.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: msg.content,
        }));

        logger.debug('Anthropic request', {
            model: model || 'claude-3-sonnet-20240229',
            messageCount: formattedMessages.length,
            systemPromptLength: effectiveSystemPrompt.length,
            temperature,
            maxTokens,
        });

        const response = await this.getAnthropicMessagesClient().create({
            model: model || 'claude-3-sonnet-20240229',
            max_tokens: maxTokens,
            temperature,
            system: effectiveSystemPrompt,
            messages: formattedMessages,
        }) as AnthropicMessageResponse;

        const firstContent = response.content[0];
        const contentLength = firstContent && firstContent.type === 'text' && firstContent.text
            ? firstContent.text.length
            : 0;

        logger.debug('Anthropic response', {
            model: response.model,
            usage: response.usage,
            stopReason: response.stop_reason,
            contentLength,
        });

        // Handle ContentBlock type safely
        const textContent = firstContent.type === 'text' ? firstContent.text || '' : '';

        return {
            content: textContent,
            metadata: {
                model: response.model,
                usage: response.usage,
                stop_reason: response.stop_reason,
            },
        };
    }

    private async generateGeminiResponse(
        model: string,
        messages: LLMMessage[],
        systemPrompt: string | undefined,
        temperature: number,
        maxTokens: number
    ): Promise<LLMResponse> {
        const effectiveSystemPrompt = systemPrompt || 'You are a helpful assistant.';

        // Gemini doesn't support a separate system message, so we prepend it to the first user message
        const formattedMessages = messages.map((msg, index) => {
            const role = msg.sender === 'user' || msg.role === 'user' ? 'user' : 'model';
            let content = msg.content;

            // Prepend system prompt to first user message
            if (index === 0 && role === 'user') {
                content = `${effectiveSystemPrompt}\n\n${content}`;
            }

            return {
                role,
                parts: [{ text: content }],
            };
        });

        logger.debug('Gemini request', {
            model: model || 'gemini-pro',
            messageCount: formattedMessages.length,
            systemPromptLength: effectiveSystemPrompt.length,
            temperature,
            maxTokens,
        });

        const geminiModel = this.gemini.getGenerativeModel({
            model: model || 'gemini-pro',
            generationConfig: {
                temperature,
                maxOutputTokens: maxTokens,
            },
        });

        const chat = geminiModel.startChat({
            history: formattedMessages.slice(0, -1), // All messages except the last one
        });

        const lastMessage = formattedMessages[formattedMessages.length - 1];
        const result = await chat.sendMessage(lastMessage.parts[0].text);
        const response = result.response;
        const text = response.text();

        logger.debug('Gemini response', {
            model: model || 'gemini-pro',
            contentLength: text.length,
        });

        return {
            content: text,
            metadata: {
                model: model || 'gemini-pro',
                candidatesCount: response.candidates?.length || 0,
            },
        };
    }

    async generateStreamingResponse(
        provider: LLMProvider,
        model: string,
        messages: LLMMessage[],
        systemPrompt: string = '',
        onChunk: (chunk: string) => Promise<void>,
        temperature: number | string = config.llm.defaultTemperature,
        maxTokens: number | string = config.llm.defaultMaxTokens
    ): Promise<LLMResponse> {
        try {
            const temp = parseFloat(temperature.toString());
            const maxTok = parseInt(maxTokens.toString(), 10);

            switch (provider) {
                case 'openai':
                    return await this.generateOpenAIStreamingResponse(model, messages, systemPrompt, onChunk, temp, maxTok);
                case 'anthropic':
                    return await this.generateAnthropicStreamingResponse(model, messages, systemPrompt, onChunk, temp, maxTok);
                case 'gemini':
                    return await this.generateGeminiStreamingResponse(model, messages, systemPrompt, onChunk, temp, maxTok);
                default:
                    throw new Error(`Unsupported LLM provider: ${provider}`);
            }
        } catch (error) {
            logger.error('LLM streaming generation error:', error);
            throw error;
        }
    }

    private async generateOpenAIStreamingResponse(
        model: string,
        messages: LLMMessage[],
        systemPrompt: string,
        onChunk: (chunk: string) => Promise<void>,
        temperature: number,
        maxTokens: number
    ): Promise<LLMResponse> {
        const formattedMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPrompt },
            ...messages.map(msg => ({
                role: (msg.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
                content: msg.content,
            })),
        ];

        const temperaturePayload = this.getOpenAITemperatureParam(model, temperature);
        const appliedTemperature = temperaturePayload.temperature ?? 1;

        logger.debug('OpenAI streaming request', {
            model: model || 'gpt-5-mini',
            messageCount: formattedMessages.length,
            systemPromptLength: systemPrompt.length,
            temperature: appliedTemperature,
            maxTokens,
        });

        const stream = await this.openai.chat.completions.create({
            model: model || 'gpt-5-mini',
            messages: formattedMessages,
            ...temperaturePayload,
            ...this.getOpenAIMaxTokenParam(model, maxTokens),
            stream: true,
        });

        let fullContent = '';
        let metadata: { model?: string; finish_reason?: string } = {};
        let chunkCount = 0;

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
                fullContent += delta;
                chunkCount++;
                await onChunk(delta);
            }

            if (chunk.choices[0]?.finish_reason) {
                metadata = {
                    model: chunk.model,
                    finish_reason: chunk.choices[0].finish_reason,
                };
            }
        }

        logger.debug('OpenAI streaming response completed', {
            model: metadata.model,
            finishReason: metadata.finish_reason,
            totalChunks: chunkCount,
            contentLength: fullContent.length,
        });

        return {
            content: fullContent,
            metadata,
        };
    }

    private async generateAnthropicStreamingResponse(
        model: string,
        messages: LLMMessage[],
        systemPrompt: string,
        onChunk: (chunk: string) => Promise<void>,
        temperature: number,
        maxTokens: number
    ): Promise<LLMResponse> {
        const formattedMessages: AnthropicMessage[] = messages.map(msg => ({
            role: (msg.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: msg.content,
        }));

        logger.debug('Anthropic streaming request', {
            model: model || 'claude-3-sonnet-20240229',
            messageCount: formattedMessages.length,
            systemPromptLength: systemPrompt.length,
            temperature,
            maxTokens,
        });

        const stream = await this.getAnthropicMessagesClient().create({
            model: model || 'claude-3-sonnet-20240229',
            max_tokens: maxTokens,
            temperature,
            system: systemPrompt,
            messages: formattedMessages,
            stream: true,
        });

        let fullContent = '';
        let metadata: { stop_reason?: string } = {};
        let chunkCount = 0;

        for await (const event of stream as AsyncIterable<AnthropicStreamEvent>) {
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                const delta = event.delta.text;
                if (delta) {
                    fullContent += delta;
                    chunkCount++;
                    await onChunk(delta);
                }
            }

            if (event.type === 'message_stop') {
                metadata = {
                    stop_reason: event.stop_reason || 'unknown',
                };
            }
        }

        logger.debug('Anthropic streaming response completed', {
            totalChunks: chunkCount,
            contentLength: fullContent.length,
        });

        return {
            content: fullContent,
            metadata,
        };
    }

    private async generateGeminiStreamingResponse(
        model: string,
        messages: LLMMessage[],
        systemPrompt: string,
        onChunk: (chunk: string) => Promise<void>,
        temperature: number,
        maxTokens: number
    ): Promise<LLMResponse> {
        const effectiveSystemPrompt = systemPrompt || 'You are a helpful assistant.';

        // Gemini doesn't support a separate system message, so we prepend it to the first user message
        const formattedMessages = messages.map((msg, index) => {
            const role = msg.sender === 'user' || msg.role === 'user' ? 'user' : 'model';
            let content = msg.content;

            // Prepend system prompt to first user message
            if (index === 0 && role === 'user') {
                content = `${effectiveSystemPrompt}\n\n${content}`;
            }

            return {
                role,
                parts: [{ text: content }],
            };
        });

        logger.debug('Gemini streaming request', {
            model: model || 'gemini-pro',
            messageCount: formattedMessages.length,
            systemPromptLength: effectiveSystemPrompt.length,
            temperature,
            maxTokens,
        });

        const geminiModel = this.gemini.getGenerativeModel({
            model: model || 'gemini-pro',
            generationConfig: {
                temperature,
                maxOutputTokens: maxTokens,
            },
        });

        const chat = geminiModel.startChat({
            history: formattedMessages.slice(0, -1), // All messages except the last one
        });

        const lastMessage = formattedMessages[formattedMessages.length - 1];
        const result = await chat.sendMessageStream(lastMessage.parts[0].text);

        let fullContent = '';
        let chunkCount = 0;

        for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
                fullContent += text;
                chunkCount++;
                await onChunk(text);
            }
        }

        logger.debug('Gemini streaming response completed', {
            totalChunks: chunkCount,
            contentLength: fullContent.length,
        });

        return {
            content: fullContent,
            metadata: {
                model: model || 'gemini-pro',
            },
        };
    }

    async generateEmbedding(text: string, provider: string = 'openai', _retries: number = 3): Promise<number[]> {
        if (provider !== 'openai' && provider !== 'anthropic') {
            throw new Error('Embeddings not supported for provider');
        }
        if (provider === 'anthropic') {
            throw new Error('Embeddings not supported for provider: anthropic');
        }

        // Call OpenAI directly
        const response = await this.openai.embeddings.create({
            model: config.llm.providers.openai.embeddingModel,
            input: text,
        });

        return response.data[0].embedding;
    }

    private estimateTokens(text: string): number {
        if (!text) {
            return 0;
        }
        return Math.ceil(text.length / this.charactersPerToken);
    }

    private buildEmbeddingBatches(texts: string[]): string[][] {
        const performance = config.ragOptimization.performance;
        const maxBatchSize = Math.max(1, performance.maxBatchSize || 20);
        const maxBatchTokens = Math.max(1, performance.maxBatchTokens || 6000);
        const batches: string[][] = [];
        let currentBatch: string[] = [];
        let currentTokens = 0;

        const flushCurrentBatch = (): void => {
            if (currentBatch.length > 0) {
                batches.push(currentBatch);
                currentBatch = [];
                currentTokens = 0;
            }
        };

        for (const text of texts) {
            const normalizedText = text ?? '';
            const estimatedTokens = this.estimateTokens(normalizedText);
            const exceedsCount = currentBatch.length >= maxBatchSize;
            const exceedsTokens = currentTokens + estimatedTokens > maxBatchTokens;

            if (currentBatch.length > 0 && (exceedsCount || exceedsTokens)) {
                flushCurrentBatch();
            }

            if (estimatedTokens > maxBatchTokens) {
                logger.warn('Embedding input exceeds batch token limit, sending separately', {
                    estimatedTokens,
                    maxBatchTokens,
                });
                batches.push([normalizedText]);
                continue;
            }

            currentBatch.push(normalizedText);
            currentTokens += estimatedTokens;
        }

        flushCurrentBatch();
        return batches;
    }

    private async requestOpenAiEmbeddings(inputs: string[], _retries: number): Promise<number[][]> {
        const response = await this.openai.embeddings.create({
            model: config.llm.providers.openai.embeddingModel,
            input: inputs,
        });

        return response.data.map(item => item.embedding);
    }

    async generateBatchEmbeddings(texts: string[], provider: string = 'openai', retries: number = 3): Promise<number[][]> {
        if (!texts || texts.length === 0) {
            return [];
        }

        if (provider !== 'openai') {
            throw new Error(`Batch embeddings not supported for provider: ${provider}`);
        }

        const performance = config.ragOptimization.performance;
        const shouldBatch = performance.useBatchEmbeddings !== false;

        if (!shouldBatch || texts.length === 1) {
            const sequentialEmbeddings: number[][] = [];
            for (const text of texts) {
                const embedding = await this.generateEmbedding(text, provider, retries);
                sequentialEmbeddings.push(embedding);
            }
            return sequentialEmbeddings;
        }

        const batches = this.buildEmbeddingBatches(texts);
        const allEmbeddings: number[][] = [];

        for (const batch of batches) {
            const batchEmbeddings = await this.requestOpenAiEmbeddings(batch, retries);
            allEmbeddings.push(...batchEmbeddings);
        }

        return allEmbeddings;
    }

    async describeImageFromBuffer(options: DescribeImageFromBufferOptions): Promise<string> {
        const {
            buffer,
            mimeType,
            prompt,
            provider = config.visualExtraction.visionProvider,
            model = config.visualExtraction.visionModel,
            maxTokens = 600,
        } = options;

        if (!buffer || buffer.length === 0) {
            throw new Error('Image buffer is empty');
        }

        switch (provider) {
            case 'openai': {
                const base64 = buffer.toString('base64');
                const imageUrl = `data:${mimeType};base64,${base64}`;
                const temperaturePayload = this.getOpenAITemperatureParam(model, 1);
                const response = await this.openai.chat.completions.create({
                    model: model || 'gpt-4o-mini',
                    ...temperaturePayload,
                    ...this.getOpenAIMaxTokenParam(model, maxTokens),
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: prompt },
                                {
                                    type: 'image_url',
                                    image_url: { url: imageUrl },
                                },
                            ],
                        } as OpenAI.Chat.ChatCompletionMessageParam,
                    ],
                });

                const messageContent = response.choices[0]?.message?.content;
                if (!messageContent) {
                    return '';
                }

                if (typeof messageContent === 'string') {
                    return messageContent.trim();
                }

                if (Array.isArray(messageContent)) {
                    const parts = messageContent as Array<string | { text?: string }>;
                    return parts
                        .map((part: string | { text?: string }) => {
                            if (typeof part === 'string') {
                                return part;
                            }
                            if (part && typeof part.text === 'string') {
                                return part.text;
                            }
                            return '';
                        })
                        .join(' ')
                        .trim();
                }

                return '';
            }
            case 'anthropic': {
                const base64 = buffer.toString('base64');
                const response = await this.getAnthropicMessagesClient().create({
                    model: model || 'claude-3-5-sonnet-20241022',
                    max_tokens: maxTokens,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: prompt },
                                {
                                    type: 'image',
                                    source: {
                                        type: 'base64',
                                        media_type: mimeType,
                                        data: base64,
                                    },
                                },
                            ],
                        },
                    ],
                }) as AnthropicMessageResponse;

                const textBlocks = response.content
                    .filter(block => block.type === 'text' && block.text)
                    .map(block => block.text as string);
                return textBlocks.join('\n').trim();
            }
            default:
                throw new Error(`Vision not supported for provider: ${provider}`);
        }
    }

    private getOpenAIMaxTokenParam(model: string | undefined, maxTokens: number): { max_tokens?: number; max_completion_tokens?: number } {
        const normalized = (model || '').toLowerCase();
        if (normalized.includes('gpt-5') || normalized.includes('o1')) {
            return { max_completion_tokens: maxTokens };
        }
        return { max_tokens: maxTokens };
    }

    private getOpenAITemperatureParam(model: string | undefined, temperature: number): { temperature?: number } {
        const normalized = (model || '').toLowerCase();
        if (normalized.includes('gpt-5') || normalized.includes('o1')) {
            return {};
        }
        return { temperature };
    }
}

export default new LLMService();
