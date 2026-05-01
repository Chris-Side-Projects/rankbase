/**
 * tag-images.ts — Generate tags for untagged images using Flash (prompt-based).
 *
 * Uses google/gemini-2.5-flash via OpenRouter to generate structured tags
 * from each image's generation prompt. No vision model needed.
 *
 * Usage (from any app):
 *   OPENROUTER_API_KEY=sk-or-... IMAGE_TABLE=aega_images npx ts-node src/scripts/tag-images.ts
 *   Or via npm script: npm run tag-images
 *
 * Safe to re-run — skips images that already have tags.
 *
 * Config via env:
 *   OPENROUTER_API_KEY  — required, use a dedicated key with spend cap
 *   IMAGE_TABLE         — Supabase table name (default: "images")
 *   BATCH_SIZE          — images per run (default: 10)
 *   NSFW                — if "true", tagging prompt includes adult content awareness
 */

import { getSupabase } from '../services/supabase';
import { logger } from '../lib/logger';

const OPENROUTER_API_KEY = process.env['OPENROUTER_API_KEY'] ?? '';
const IMAGE_TABLE = process.env['IMAGE_TABLE'] ?? 'images';
const BATCH_SIZE = parseInt(process.env['BATCH_SIZE'] ?? '10', 10);
const NSFW = process.env['NSFW'] === 'true';

interface TagResult {
  tags: string[];
  style_tags: string[];
  subject_tags: string[];
  mood_tags: string[];
}

async function generateTags(prompt: string): Promise<TagResult | null> {
  const nsfwContext = NSFW
    ? 'This is an adult AI image platform. Tags may include mature themes where relevant.'
    : 'This is an AI image platform.';

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: `You are an art cataloguing system. ${nsfwContext} Generate structured tags for an image described as: "${prompt}"

Return ONLY valid JSON with exactly these 4 arrays:
- tags: 6-10 general descriptors (subject, style, mood, colors, setting)
- style_tags: 3-5 artistic style descriptors (e.g. "photorealistic", "painterly", "cinematic")
- subject_tags: 3-5 subject descriptors (what/who is depicted, e.g. "woman", "landscape", "portrait")
- mood_tags: 2-4 mood/atmosphere descriptors (e.g. "mysterious", "romantic", "energetic")

All tags: lowercase, no punctuation, max 3 words each.

JSON only, no markdown:`,
          },
        ],
        max_tokens: 300,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'tag generation request failed');
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as TagResult;
    if (!Array.isArray(parsed.tags)) return null;

    return {
      tags: parsed.tags ?? [],
      style_tags: parsed.style_tags ?? [],
      subject_tags: parsed.subject_tags ?? [],
      mood_tags: parsed.mood_tags ?? [],
    };
  } catch (err) {
    logger.warn({ err }, 'tag generation error');
    return null;
  }
}

export async function main() {
  if (!OPENROUTER_API_KEY) {
    logger.error('OPENROUTER_API_KEY not set');
    process.exit(1);
  }

  logger.info({ table: IMAGE_TABLE, batchSize: BATCH_SIZE, nsfw: NSFW }, 'tag-images starting');

  const supabase = getSupabase();

  const { data: images, error } = await supabase
    .from(IMAGE_TABLE)
    .select('id, prompt')
    .or('tags.eq.[],tags.is.null')
    .not('prompt', 'is', null)
    .limit(BATCH_SIZE);

  if (error) {
    logger.error({ error }, 'failed to fetch untagged images');
    process.exit(1);
  }

  logger.info({ count: images?.length ?? 0 }, 'images to tag');

  if (!images?.length) {
    logger.info('all images tagged');
    return;
  }

  let tagged = 0;
  let failed = 0;

  for (const image of images) {
    if (!image.prompt) continue;

    logger.info({ id: image.id }, 'tagging image');
    const result = await generateTags(image.prompt);

    if (!result) {
      logger.warn({ id: image.id }, 'tag generation failed, skipping');
      failed++;
      continue;
    }

    const { error: updateError } = await supabase
      .from(IMAGE_TABLE)
      .update({
        tags: result.tags,
        style_tags: result.style_tags,
        subject_tags: result.subject_tags,
        mood_tags: result.mood_tags,
      })
      .eq('id', image.id);

    if (updateError) {
      logger.warn({ id: image.id, error: updateError }, 'failed to update tags');
      failed++;
    } else {
      tagged++;
      logger.info({ id: image.id, tags: result.tags }, 'tagged');
    }

    // Rate limit: stay under OpenRouter burst limits
    await new Promise((r) => setTimeout(r, 1000));
  }

  logger.info({ tagged, failed }, 'tagging complete');
}

// Run if called directly (ts-node or compiled)
if (require.main === module) {
  main().catch((err) => {
    logger.error({ err }, 'fatal error');
    process.exit(1);
  });
}
