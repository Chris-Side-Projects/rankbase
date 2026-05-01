import { getRedis } from '@rankbase/core/lib/redis';
import { logger } from '@rankbase/core/lib/logger';

/**
 * Multi-model "merry-go-round" selector for aega.art.
 *
 * Picks the next image generation model in a fixed rotation, so over time
 * each model contributes roughly the same number of images.
 *
 * The rotation index is incremented atomically in Redis (INCR returns the
 * new value), giving us a global counter shared across web and worker
 * processes. When Redis is unavailable we fall back to an in-process
 * counter.
 */
// Only adult-content-capable providers. DALL-E 3 and Stability SD3 removed
// — both hard-block explicit prompts with content_policy_violation errors.
export const MODEL_ROTATION = [
  'fal-flux-dev', // Fal Flux.1 Dev (safety checker disabled)
  'civitai-dreamshaper', // Civitai NSFW models (LUSTIFY, PornMaster, BigLove, Copax)
  'fal-flux-schnell', // Fal Flux.1 Schnell (safety checker disabled)
  'getimg-seedream', // getimg.ai Seedream 5.0 Lite
] as const;

export type ModelName = (typeof MODEL_ROTATION)[number];

const ROTATION_KEY = 'aega:model:rotation:index';
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

  const idx =
    (((next - 1) % MODEL_ROTATION.length) + MODEL_ROTATION.length) % MODEL_ROTATION.length;
  return MODEL_ROTATION[idx];
}

/**
 * Returns the rotation order starting at the given primary model. Used by
 * the generation cascade to try the primary first, then walk the rest of
 * the rotation as fallbacks.
 */
export function rotationStartingFrom(primary: ModelName): ModelName[] {
  const start = MODEL_ROTATION.indexOf(primary);
  if (start < 0) return [...MODEL_ROTATION];
  return [...MODEL_ROTATION.slice(start), ...MODEL_ROTATION.slice(0, start)];
}
