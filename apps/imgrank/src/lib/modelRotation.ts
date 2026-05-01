import { getRedis } from '@rankbase/core/lib/redis';
import { logger } from '@rankbase/core/lib/logger';

/**
 * Multi-model "merry-go-round" selector.
 *
 * Picks the next image generation model in a fixed rotation, so over time
 * each model contributes roughly the same number of images. This replaces
 * the older fixed cascade (always start with fal-flux-dev) which biased
 * the corpus heavily toward one provider.
 *
 * The rotation index is incremented atomically in Redis (INCR returns the
 * new value), giving us a global counter shared across web and worker
 * processes. When Redis is unavailable we fall back to an in-process
 * counter — fine for dev/test, accepted to drift in single-instance
 * deployments without Redis.
 */
export const MODEL_ROTATION = [
  'fal-flux-dev',
  'fal-flux-schnell',
  'dalle3',
  'stability-sd3',
  'imagen3',
] as const;

export type ModelName = (typeof MODEL_ROTATION)[number];

const ROTATION_KEY = 'model:rotation:index';
let inProcessIndex = 0;

/**
 * Returns the next model in the rotation and advances the counter.
 * Caller-side fallback (the cascade in imageGeneration.ts) decides what
 * to do if the chosen model errors.
 */
export async function getNextModel(): Promise<ModelName> {
  const redis = getRedis();
  let next: number;

  if (redis) {
    try {
      next = await redis.incr(ROTATION_KEY);
    } catch (err) {
      logger.warn({ err }, 'modelRotation: redis incr failed, using in-process counter');
      next = ++inProcessIndex;
    }
  } else {
    next = ++inProcessIndex;
  }

  const idx = ((next - 1) % MODEL_ROTATION.length + MODEL_ROTATION.length) % MODEL_ROTATION.length;
  return MODEL_ROTATION[idx];
}

/**
 * Returns the rotation order starting at the given primary model. Used by
 * the generation cascade to try the primary first, then walk the rest of
 * the rotation as fallbacks (instead of the old hard-coded cascade).
 */
export function rotationStartingFrom(primary: ModelName): ModelName[] {
  const start = MODEL_ROTATION.indexOf(primary);
  if (start < 0) return [...MODEL_ROTATION];
  return [...MODEL_ROTATION.slice(start), ...MODEL_ROTATION.slice(0, start)];
}
