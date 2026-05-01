import { config } from '../config';
import { ProviderExhaustedError, UpstreamError } from '../lib/errors';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { wrapWithBreaker } from '../lib/circuitBreaker';
import { logger } from '../lib/logger';

/**
 * Generates an image using OpenAI's DALL-E 3 model.
 *
 * DALL-E returns base64-encoded JSON; we decode to Buffer so every provider
 * returns the same shape. ProviderExhaustedError on 429/402 triggers the
 * fallback cascade.
 */
async function callDalle(prompt: string): Promise<Buffer> {
  const response = await fetchWithTimeout('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      size: '1024x1024',
      response_format: 'b64_json',
      n: 1,
    }),
    timeoutMs: config.PROVIDER_TIMEOUT_MS,
  });

  if (response.status === 429 || response.status === 402) {
    throw new ProviderExhaustedError('OpenAI DALL-E 3', response.status);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new UpstreamError('openai', new Error(`${response.status}: ${body}`));
  }

  const json = (await response.json()) as { data: Array<{ b64_json: string }> };
  return Buffer.from(json.data[0].b64_json, 'base64');
}

export const generateWithDalle = wrapWithBreaker('openai-dalle', callDalle, {
  timeoutMs: config.PROVIDER_TIMEOUT_MS + 5_000,
});

/**
 * Uses GPT-4o's vision capability to produce 5 descriptive tags.
 *
 * Best-effort: if any step fails we return [] and let the caller proceed
 * with an untagged image. Tags are nice-to-have for the tagboard aggregate
 * but not required for the core ELO loop to function.
 */
async function callVision(imageUrl: string): Promise<string[]> {
  const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        {
          role: 'system',
          content:
            'You are an image tagger. Return exactly 5 descriptive, lowercase tags for the image as a JSON array of strings. Example: ["sunset","ocean","warm colors","landscape","peaceful"]. Return ONLY the JSON array, no other text.',
        },
        {
          role: 'user',
          content: [{ type: 'image_url', image_url: { url: imageUrl } }],
        },
      ],
      max_tokens: 100,
    }),
    timeoutMs: config.PROVIDER_TIMEOUT_MS,
  });

  if (!response.ok) {
    logger.warn({ status: response.status }, 'vision tagging failed, skipping tags');
    return [];
  }

  const json = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = json.choices[0]?.message.content.trim() ?? '[]';

  try {
    const tags = JSON.parse(content);
    if (Array.isArray(tags) && tags.every((t: unknown) => typeof t === 'string')) {
      return tags.slice(0, 5);
    }
  } catch {
    logger.warn({ content }, 'vision tagging returned invalid JSON, skipping tags');
  }
  return [];
}

export const tagImageWithVision = wrapWithBreaker('openai-vision', callVision, {
  timeoutMs: config.PROVIDER_TIMEOUT_MS + 5_000,
});
