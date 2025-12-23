import rateLimit, { RateLimitRequestHandler, Options } from 'express-rate-limit';
import { Request, Response } from 'express';

export const generalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Limit each IP to 2000 requests per windowMs (supports ~2 req/s)
  message: 'Too many requests from this IP, please try again later.',
});

export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 200 : 10,
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request): string => {
    // Debug logging to see what IP is being used
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AuthRateLimit] Request from IP: ${req.ip}, X-Forwarded-For: ${req.headers['x-forwarded-for']}`);
    }
    return req.ip || 'unknown';
  },
  handler: (req: Request, res: Response, _next, options: Options): void => {
    console.error(`[AuthRateLimit] BLOCKED request from IP: ${req.ip}`);
    res.status(options.statusCode || 429).send(options.message);
  },
});

export const chatLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 messages per minute
  message: 'Too many messages, please slow down.',
});
