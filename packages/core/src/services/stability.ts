import { config } from '../config';
import { ProviderExhaustedError, UpstreamError } from '../lib/errors';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { wrapWithBreaker } from '../lib/circuitBreaker';

/**
 * Generates an image using Stability AI's SD3 Turbo model.
 *
 * The Stability API accepts multipart form data and returns raw image bytes
 * when Accept: image/*. Requesting raw bytes avoids base64 round-tripping.
 *
 * On HTTP 429 (rate limit) or 402 (insufficient credits) we throw a
 * ProviderExhaustedError so the generate route can fall through to DALL-E.
 * Every other non-2xx is a real upstream failure.
 *
 * Wrapped in a circuit breaker so a sustained outage doesn't saturate our
 * request pool waiting for timeouts.
 */
async function call(prompt: string): Promise<Buffer> {
  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('output_format', 'png');
  formData.append('model', 'sd3-turbo');
  formData.append('seed', String(Math.floor(Math.random() * 2147483647)));

  const response = await fetchWithTimeout(
    'https://api.stability.ai/v2beta/stable-image/generate/sd3',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.STABILITY_KEY}`,
        Accept: 'image/*',
      },
      body: formData,
      timeoutMs: config.PROVIDER_TIMEOUT_MS,
    }
  );

  if (response.status === 429 || response.status === 402) {
    throw new ProviderExhaustedError('Stability AI', response.status);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new UpstreamError('stability', new Error(`${response.status}: ${body}`));
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export const generateWithStability = wrapWithBreaker('stability', call, {
  timeoutMs: config.PROVIDER_TIMEOUT_MS + 5_000,
});
