import { Request, Response, NextFunction } from 'express';
import { RateLimitedError } from '../lib/errors';

/**
 * In-memory, IP-based rate limiter (legacy).
 *
 * This is preserved as a fallback for local dev and tests. The production
 * deployment uses the Redis-backed limiter in ./rateLimitRedis.ts, which
 * survives restarts and works across multiple instances.
 *
 * Implementation: a Map keyed by IP. Each entry holds a counter and a
 * window-expiry timestamp. A periodic sweep evicts expired entries so the
 * map doesn't grow unbounded.
 */

interface RateEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateEntry>();

// Sweep expired entries every 60s. .unref() so the timer doesn't pin the
// event loop and block graceful shutdown.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) store.delete(key);
  }
}, 60_000).unref();

export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || now >= entry.resetAt) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return next(new RateLimitedError('Too many requests', retryAfter));
    }

    next();
  };
}
