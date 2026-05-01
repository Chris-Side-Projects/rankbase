import type { RequestHandler } from 'express';
import expressRateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedis } from '../lib/redis';
import { rateLimit as memoryRateLimit } from './rateLimit';
import { RateLimitedError } from '../lib/errors';

/**
 * Redis-backed rate limiter. Survives restarts and works across horizontally
 * scaled instances — which the in-memory limiter does not.
 *
 * Falls back to the in-memory limiter when REDIS_URL is unset (dev/test).
 * Same API surface, so routes don't care which backing store is in use.
 *
 * Implementation detail: rate-limit-redis counts with Redis INCR + EXPIRE,
 * which is O(1) per request. Even a local Redis adds <1ms latency.
 */
export function rateLimitRedis(maxRequests: number, windowMs: number): RequestHandler {
  const redis = getRedis();
  if (!redis) return memoryRateLimit(maxRequests, windowMs);

  return expressRateLimit({
    windowMs,
    limit: maxRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Forward the rate limit violation into our typed error taxonomy so the
    // global error handler renders it consistently with every other 4xx/5xx.
    handler: (_req, res, next) => {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.set('Retry-After', String(retryAfter));
      next(new RateLimitedError('Too many requests', retryAfter));
    },
    store: new RedisStore({
      // sendCommand is how rate-limit-redis avoids taking a hard dep on ioredis.
      // ioredis's .call signature is looser than RedisStore's so we cast.
      sendCommand: ((command: string, ...args: string[]) =>
        redis.call(command, ...args)) as unknown as (...args: string[]) => Promise<unknown>,
    } as unknown as ConstructorParameters<typeof RedisStore>[0]),
  });
}
