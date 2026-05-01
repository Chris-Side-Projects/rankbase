import { getRandomPrompt } from '@rankbase/core/lib/prompts';
import { generateWithFalDev as generateWithFal, generateWithFalSchnell } from '@rankbase/core/services/fal';
import { generateWithStability } from '@rankbase/core/services/stability';
import { generateWithDalle, tagImageWithVision } from '@rankbase/core/services/openai';
import { generateWithImagen } from '@rankbase/core/services/google';
import { uploadToCloudflareImages } from '@rankbase/core/services/cloudflare';
import { moderateText } from '@rankbase/core/services/moderation';
import { getSupabase } from '@rankbase/core/services/supabase';
import { AppError, ProviderExhaustedError, ProvidersExhaustedError } from '@rankbase/core/lib/errors';
import { logger } from '@rankbase/core/lib/logger';
import {
  getNextModel,
  rotationStartingFrom,
  type ModelName,
} from '../lib/modelRotation';

/**
 * Shared image-generation logic used by both the synchronous /generate
 * route and the async BullMQ worker.
 *
 * Flow:
 *   1. Pick a prompt (caller-supplied for hourly, random fallback otherwise);
 *      run it through OpenAI moderation.
 *   2. Pick the next model in the rotation; try it first, then walk the
 *      rotation as fallbacks if it fails. This replaces the old fixed
 *      cascade that always started with fal-flux-dev.
 *   3. Upload to Cloudflare Images.
 *   4. Tag with GPT-4o Vision (best-effort).
 *   5. Insert into images at elo=1000, votes=0, with provider +
 *      moderation_score + hidden flags set.
 */
export interface GeneratedImage {
  id: string;
  prompt: string;
  provider: string;
  url: string;
  tags: string[];
  hidden: boolean;
  moderationScore: number;
}

export interface GenerateOptions {
  correlationId?: string;
  /** The text actually sent to moderation + the image provider. */
  prompt?: string;
  /** Optional override for what gets persisted on images.prompt. Useful for
   *  the hourly flow where we expand a short prompt before generation but
   *  want to display the short, human-readable version on the site. */
  storedPrompt?: string;
}

const HARD_FLAG_THRESHOLD = 0.85;
const AUTO_HIDE_THRESHOLD = 0.5;

type Generator = (prompt: string) => Promise<Buffer>;

const GENERATORS: Record<ModelName, Generator> = {
  'fal-flux-dev': generateWithFal,
  'fal-flux-schnell': generateWithFalSchnell,
  dalle3: generateWithDalle,
  'stability-sd3': generateWithStability,
  imagen3: generateWithImagen,
};

export async function generateOneImage(opts: GenerateOptions = {}): Promise<GeneratedImage> {
  const prompt = opts.prompt ?? getRandomPrompt();
  const logCtx = { reqId: opts.correlationId };

  // ---- Pre-generation moderation ----
  const moderation = await moderateText(prompt);
  if (moderation.flagged && moderation.score >= HARD_FLAG_THRESHOLD) {
    logger.warn({ ...logCtx, score: moderation.score, prompt }, 'prompt rejected by moderation');
    throw new AppError({
      status: 422,
      code: 'BAD_REQUEST',
      message: 'Prompt rejected by moderation',
      details: { score: moderation.score },
    });
  }

  // ---- Multi-model rotation cascade ----
  const primary = await getNextModel();
  const order = rotationStartingFrom(primary);

  let imageBuffer: Buffer | null = null;
  let provider: ModelName | null = null;
  let lastError: unknown = null;

  for (const candidate of order) {
    try {
      imageBuffer = await GENERATORS[candidate](prompt);
      provider = candidate;
      if (candidate !== primary) {
        logger.info({ ...logCtx, primary, used: candidate }, 'rotation primary failed, used fallback');
      }
      break;
    } catch (err) {
      lastError = err;
      if (err instanceof ProviderExhaustedError) {
        logger.info(
          { ...logCtx, candidate, status: err.statusCode },
          'rotation candidate exhausted, trying next'
        );
        continue;
      }
      throw err;
    }
  }

  if (!imageBuffer || !provider) {
    if (lastError instanceof ProviderExhaustedError) throw new ProvidersExhaustedError();
    throw new ProvidersExhaustedError();
  }

  const url = await uploadToCloudflareImages(imageBuffer, { prompt, provider });

  // Best-effort vision tagging.
  let tags: string[] = [];
  try {
    tags = await tagImageWithVision(url);
  } catch (err) {
    logger.warn({ ...logCtx, err }, 'vision tagging failed, proceeding without tags');
  }

  const hidden = moderation.score >= AUTO_HIDE_THRESHOLD;
  if (hidden) {
    logger.info(
      { ...logCtx, score: moderation.score, prompt },
      'auto-hiding image: moderation borderline'
    );
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('images')
    .insert({
      url,
      prompt,
      tags,
      elo: 1000,
      votes: 0,
      provider,
      moderation_score: moderation.score,
      hidden,
    })
    .select('id')
    .single();

  if (error) {
    throw new AppError({
      status: 500,
      code: 'INTERNAL',
      message: `Database insert failed: ${error.message}`,
      expose: false,
    });
  }

  return {
    id: data.id,
    prompt,
    provider,
    url,
    tags,
    hidden,
    moderationScore: moderation.score,
  };
}
