import { getRandomPrompt } from '@rankbase/core/lib/prompts';
import { generateWithFalDev, generateWithFalSchnell } from '@rankbase/core/services/fal';
import { tagImageWithVision } from '@rankbase/core/services/openai';
import { uploadToCloudflareImages } from '@rankbase/core/services/cloudflare';
import { describeImage } from '@rankbase/core/services/describe';
import { getSupabase } from '@rankbase/core/services/supabase';
import { ProviderExhaustedError, ProvidersExhaustedError, internalError } from '@rankbase/core/lib/errors';
import { logger } from '@rankbase/core/lib/logger';
import { getNextModel, rotationStartingFrom, ModelName } from '../lib/modelRotation';
import { generateWithGetImg } from './getimg';
import { generateWithCivitai } from './civitai';

/**
 * Shared image-generation logic used by both the synchronous /generate
 * route and the async BullMQ worker.
 *
 * aega.art intentionally allows adult content, so the OpenAI moderation
 * pre-check that imgrank uses has been removed. Provider order now uses
 * a multi-model rotation instead of a hardcoded cascade.
 */
export interface GeneratedImage {
  id: string;
  prompt: string;
  provider: string;
  url: string;
  tags: string[];
  description: string | null;
}

// Only adult-content-capable providers
const GENERATORS: Record<ModelName, (prompt: string) => Promise<Buffer>> = {
  'fal-flux-dev': generateWithFalDev,
  'civitai-dreamshaper': generateWithCivitai,
  'fal-flux-schnell': generateWithFalSchnell,
  'getimg-seedream': generateWithGetImg,
};

export async function generateOneImage(
  opts: { correlationId?: string } = {}
): Promise<GeneratedImage> {
  const prompt = getRandomPrompt();
  const logCtx = { reqId: opts.correlationId };

  // Get the next model in rotation
  const primaryModel = await getNextModel();
  const rotationOrder = rotationStartingFrom(primaryModel);

  logger.info(
    { ...logCtx, primaryModel, rotationOrder },
    'Starting generation with model rotation'
  );

  // ---- Provider fallback cascade based on rotation ----
  let imageBuffer: Buffer | undefined;
  let provider: string | undefined;

  for (const model of rotationOrder) {
    try {
      const generator = GENERATORS[model];
      if (!generator) {
        logger.warn({ ...logCtx, model }, 'No generator found for model, skipping');
        continue;
      }

      imageBuffer = await generator(prompt);
      provider = model;
      logger.info({ ...logCtx, provider: model }, 'Successfully generated image');
      break;
    } catch (err) {
      if (!(err instanceof ProviderExhaustedError)) throw err;
      logger.info(
        { ...logCtx, status: err.statusCode, provider: model },
        `${model} exhausted, trying next provider`
      );
    }
  }

  if (!imageBuffer || !provider) {
    throw new ProvidersExhaustedError();
  }

  const url = await uploadToCloudflareImages(imageBuffer, { prompt, provider });

  // Best-effort vision tagging (legacy, single-model).
  let tags: string[] = [];
  try {
    tags = await tagImageWithVision(url);
  } catch (err) {
    logger.warn({ ...logCtx, err }, 'vision tagging failed, proceeding without tags');
  }

  // Multi-model description + structured tags (style/subject/mood).
  let description: string | null = null;
  let descriptionModels: string[] = [];
  let styleTags: string[] = [];
  let subjectTags: string[] = [];
  let moodTags: string[] = [];
  try {
    const result = await describeImage(url);
    description = result.description;
    descriptionModels = result.models;
    styleTags = result.tags.style;
    subjectTags = result.tags.subject;
    moodTags = result.tags.mood;
  } catch (err) {
    logger.warn({ ...logCtx, err }, 'description pipeline failed');
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('aega_images')
    .insert({
      url,
      prompt,
      tags,
      elo: 1000,
      votes: 0,
      provider,
      description,
      description_models: descriptionModels,
      style_tags: styleTags,
      subject_tags: subjectTags,
      mood_tags: moodTags,
    })
    .select('id')
    .single();

  if (error) {
    throw internalError(`Database insert failed: ${error.message}`);
  }

  return {
    id: data.id,
    prompt,
    provider,
    url,
    tags,
    description,
  };
}
