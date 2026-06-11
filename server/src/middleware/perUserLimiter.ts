/**
 * Per-user rate limiter factory.
 *
 * express-rate-limit ships with an in-memory MemoryStore that does not
 * survive Vercel serverless cold starts. For our deployment that's
 * acceptable for low-stakes endpoints (login, signup) where being
 * forgiving on a cold start is fine. For everything that costs us money
 * (LLM calls, paid AI fallbacks, meal regenerations) we pair the
 * in-memory limiter with a persistent per-day counter in the DB
 * (see `planGenerationUsage` table).
 *
 * This factory returns a limiter keyed on `req.userId` when authenticated
 * (so two users behind the same NAT don't share a bucket) and falls back
 * to `req.ip` for unauthenticated routes.
 *
 * Usage:
 *   router.post('/expensive', requireAuth, perUserLimiter({ windowMs: 60_000, max: 5 }), handler);
 */
import rateLimit, { ipKeyGenerator, RateLimitRequestHandler } from 'express-rate-limit';
import { AuthRequest } from './auth';

export interface PerUserLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
}

export function perUserLimiter(opts: PerUserLimiterOptions): RateLimitRequestHandler {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const ar = req as AuthRequest;
      const ip = ipKeyGenerator(req.ip ?? 'unknown');
      return opts.keyPrefix
        ? `${opts.keyPrefix}:${ar.userId ?? `ip:${ip}`}`
        : (ar.userId ?? `ip:${ip}`);
    },
    handler: (_req, res) => {
      res.status(429).json({
        error: 'rate_limit',
        message: opts.message ?? 'Too many requests. Please slow down.',
      });
    },
  });
}
