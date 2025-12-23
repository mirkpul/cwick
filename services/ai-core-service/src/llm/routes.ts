import express, { Request, Response, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import type {
  ApiResponse,
  GenerateResponseRequest,
  GenerateEmbeddingRequest,
  LLMResponse,
  EmbeddingResponse,
} from '@virtualcoach/shared-types';
import { config } from './config';
import { logger } from './logger';
import { resolveProvider } from './providers';
import { estimateCost, estimateEmbeddingCost } from './cost';
import { UsageTracker } from './usageTracker';

export function buildRouter(usageTracker: UsageTracker) {
  const router = express.Router();

  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ((req: any) => {
      const userId = (req.headers['x-user-id'] as string) || '';
      const twinId = (req.headers['x-twin-id'] as string) || '';
      const ip = req.ip || req.socket.remoteAddress || '';
      return `${userId}:${twinId}:${ip}`;
    }) as any,
  });

  router.use(limiter as unknown as RequestHandler);
  router.use(express.json({ limit: '1mb' }));

  router.get('/health', (req, res: Response<ApiResponse>) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        service: 'llm-gateway',
        version: '0.1.0',
        uptime: process.uptime(),
        timestamp: new Date(),
      },
    });
  });

  router.post('/generate', async (req: Request, res: Response<ApiResponse<LLMResponse>>) => {
    const body = req.body as GenerateResponseRequest;
    const providerName = (body.provider || config.defaultProvider) as 'openai' | 'anthropic';
    const model = body.model || config.defaultModel;

    try {
      const provider = resolveProvider(providerName, config.openaiApiKey, config.anthropicApiKey);
      const { response, usage } = await provider.chat({ ...body, provider: providerName, model });
      const cost = estimateCost(providerName, model, usage);

      await usageTracker.track({
        provider: providerName,
        model,
        operation: 'chat',
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
        costUsd: cost,
        userId: (req.headers['x-user-id'] as string) || undefined,
        twinId: (req.headers['x-twin-id'] as string) || undefined,
        metadata: { path: '/generate' },
      });

      return res.status(200).json({ success: true, data: response });
    } catch (error: any) {
      const shouldFallback =
        providerName === 'openai' &&
        model !== config.fallbackModels.openai &&
        (error.message?.includes('rate limit') || error.status === 429);

      if (shouldFallback) {
        try {
          const fallbackModel = config.fallbackModels.openai;
          const provider = resolveProvider(providerName, config.openaiApiKey, config.anthropicApiKey);
          const { response, usage } = await provider.chat({
            ...body,
            provider: providerName,
            model: fallbackModel,
          });
          const cost = estimateCost(providerName, fallbackModel, usage);

          await usageTracker.track({
            provider: providerName,
            model: fallbackModel,
            operation: 'chat',
            promptTokens: usage?.prompt_tokens || 0,
            completionTokens: usage?.completion_tokens || 0,
            totalTokens: usage?.total_tokens || 0,
            costUsd: cost,
            userId: (req.headers['x-user-id'] as string) || undefined,
            twinId: (req.headers['x-twin-id'] as string) || undefined,
            metadata: { path: '/generate', fallback: true, from: model, to: fallbackModel },
          });

          return res.status(200).json({ success: true, data: response });
        } catch (fallbackError: any) {
          logger.error('Generate endpoint fallback error', {
            error: fallbackError?.message,
            provider: providerName,
            model,
          });
        }
      }

      const status = error.message?.includes('Unauthorized') ? 401 : 500;
      logger.error('Generate endpoint error', { error: error?.message, provider: providerName, model });
      return res.status(status).json({ success: false, error: error.message || 'Internal error' });
    }
  });

  router.post('/embed', async (req: Request, res: Response<ApiResponse<EmbeddingResponse>>) => {
    const body = req.body as GenerateEmbeddingRequest;
    const providerName = (req.body.provider || config.defaultProvider) as 'openai' | 'anthropic';
    const model = body.model || config.defaultEmbeddingModel;

    try {
      const provider = resolveProvider(providerName, config.openaiApiKey, config.anthropicApiKey);
      const { response, usage } = await provider.embed({ ...body, model });
      const cost = estimateEmbeddingCost(providerName, model, usage);

      await usageTracker.track({
        provider: providerName,
        model,
        operation: 'embedding',
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: 0,
        totalTokens: usage?.total_tokens || usage?.prompt_tokens || 0,
        costUsd: cost,
        userId: (req.headers['x-user-id'] as string) || undefined,
        twinId: (req.headers['x-twin-id'] as string) || undefined,
        metadata: { path: '/embed' },
      });

      return res.status(200).json({ success: true, data: response });
    } catch (error: any) {
      logger.error('Embed endpoint error', { error: error?.message, provider: providerName });
      return res.status(500).json({ success: false, error: error.message || 'Internal error' });
    }
  });

  router.post('/embed/batch', async (req: Request, res: Response<ApiResponse<EmbeddingResponse>>) => {
    const body = req.body as GenerateEmbeddingRequest;
    if (!body.text) {
      return res.status(400).json({ success: false, error: 'text is required' });
    }
    const normalized = Array.isArray(body.text) ? body.text : [body.text];
    const providerName = (req.body.provider || config.defaultProvider) as 'openai' | 'anthropic';
    const model = body.model || config.defaultEmbeddingModel;

    try {
      const provider = resolveProvider(providerName, config.openaiApiKey, config.anthropicApiKey);
      const { response, usage } = await provider.embed({ ...body, text: normalized, model });
      const cost = estimateEmbeddingCost(providerName, model, usage);

      await usageTracker.track({
        provider: providerName,
        model,
        operation: 'embedding',
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: 0,
        totalTokens: usage?.total_tokens || usage?.prompt_tokens || 0,
        costUsd: cost,
        userId: (req.headers['x-user-id'] as string) || undefined,
        twinId: (req.headers['x-twin-id'] as string) || undefined,
        metadata: { path: '/embed/batch', items: normalized.length },
      });

      return res.status(200).json({ success: true, data: response });
    } catch (error: any) {
      logger.error('Embed batch endpoint error', { error: error?.message, provider: providerName });
      return res.status(500).json({ success: false, error: error.message || 'Internal error' });
    }
  });

  return router;
}
