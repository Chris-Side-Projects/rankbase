import Redis, { type Redis as RedisClient } from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

/**
 * Shared Redis client factory.
 *
 * Returns null when REDIS_URL is empty so callers can opt out in dev/test.
 * In production, config validation already guarantees REDIS_URL is set.
 *
 * We use a single connection for ordinary commands and a separate connection
 * for BullMQ (BullMQ requires `maxRetriesPerRequest: null`). The separate-
 * connection rule is important: if we shared one client BullMQ's blocking
 * commands would tie it up and everything else would stall.
 */

let _client: RedisClient | null = null;
let _bullClient: RedisClient | null = null;

export function getRedis(): RedisClient | null {
  if (!config.REDIS_URL) return null;
  if (!_client) {
    _client = new Redis(config.REDIS_URL, { lazyConnect: false });
    _client.on('error', (err) => logger.warn({ err }, 'redis error'));
    _client.on('connect', () => logger.info('redis connected'));
  }
  return _client;
}

/**
 * Dedicated Redis connection for BullMQ. See the note above on why this is
 * kept separate from the general-purpose client.
 */
export function getBullRedis(): RedisClient | null {
  if (!config.REDIS_URL) return null;
  if (!_bullClient) {
    _bullClient = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    _bullClient.on('error', (err) => logger.warn({ err }, 'bull redis error'));
  }
  return _bullClient;
}

export async function closeRedis(): Promise<void> {
  await Promise.allSettled([_client?.quit(), _bullClient?.quit()]);
  _client = null;
  _bullClient = null;
}
