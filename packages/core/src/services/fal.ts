import { config } from '../config';
import { ProviderExhaustedError, UpstreamError } from '../lib/errors';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { wrapWithBreaker } from '../lib/circuitBreaker';

/**
 * Generates an image using Fal.ai's Flux Dev model.
 *
 * The Fal API returns a JSON payload with image URLs; we then have to fetch
 * the image bytes ourselves (Fal hosts them on a short-lived CDN).
 */
interface FalResponse {
  images: Array<{ url: string; content_type?: string }>;
}

async function callDev(prompt: string): Promise<Buffer> {
  const response = await fetchWithTimeout('https://fal.run/fal-ai/flux/dev', {
    method: 'POST',
    headers: {
      Authorization: `Key ${config.FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_size: 'square_hd',
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: false,
    }),
    timeoutMs: config.PROVIDER_TIMEOUT_MS,
  });

  if (response.status === 429 || response.status === 402) {
    throw new ProviderExhaustedError('Fal.ai', response.status);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new UpstreamError('fal', new Error(`${response.status}: ${body}`));
  }

  const json = (await response.json()) as FalResponse;
  const url = json.images?.[0]?.url;
  if (!url) {
    throw new UpstreamError('fal', new Error('Fal response missing image url'));
  }

  const imageRes = await fetchWithTimeout(url, { timeoutMs: config.PROVIDER_TIMEOUT_MS });
  if (!imageRes.ok) {
    throw new UpstreamError('fal', new Error(`Fal image download ${imageRes.status}`));
  }

  return Buffer.from(await imageRes.arrayBuffer());
}

/**
 * Generates an image using Fal.ai's Flux Schnell model.
 *
 * Schnell is the fastest checkpoint Fal exposes (~1s end-to-end).
 */
async function callSchnell(prompt: string): Promise<Buffer> {
  const response = await fetchWithTimeout('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: {
      Authorization: `Key ${config.FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_size: 'square_hd',
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: false,
    }),
    timeoutMs: config.PROVIDER_TIMEOUT_MS,
  });

  if (response.status === 429 || response.status === 402) {
    throw new ProviderExhaustedError('Fal.ai', response.status);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new UpstreamError('fal', new Error(`${response.status}: ${body}`));
  }

  const json = (await response.json()) as FalResponse;
  const url = json.images?.[0]?.url;
  if (!url) {
    throw new UpstreamError('fal', new Error('Fal response missing image url'));
  }

  const imageRes = await fetchWithTimeout(url, { timeoutMs: config.PROVIDER_TIMEOUT_MS });
  if (!imageRes.ok) {
    throw new UpstreamError('fal', new Error(`Fal image download ${imageRes.status}`));
  }

  return Buffer.from(await imageRes.arrayBuffer());
}

export const generateWithFalDev = wrapWithBreaker('fal-dev', callDev, {
  timeoutMs: config.PROVIDER_TIMEOUT_MS + 5_000,
});

export const generateWithFalSchnell = wrapWithBreaker('fal-schnell', callSchnell, {
  timeoutMs: config.PROVIDER_TIMEOUT_MS + 5_000,
});