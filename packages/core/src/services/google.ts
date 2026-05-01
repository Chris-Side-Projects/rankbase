import { config } from '../config';
import { ProviderExhaustedError, UpstreamError } from '../lib/errors';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { wrapWithBreaker } from '../lib/circuitBreaker';

/**
 * Generates an image using Google's Imagen model via the Generative Language
 * API. Returns raw PNG bytes.
 *
 * ProviderExhaustedError on 429/402 signals "all providers exhausted" to the
 * route since Google is the last fallback in the chain.
 */
async function call(prompt: string): Promise<Buffer> {
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${config.GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1 },
      }),
      timeoutMs: config.PROVIDER_TIMEOUT_MS,
    }
  );

  if (response.status === 429 || response.status === 402) {
    throw new ProviderExhaustedError('Google Imagen', response.status);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new UpstreamError('google-imagen', new Error(`${response.status}: ${body}`));
  }

  const json = (await response.json()) as {
    predictions: Array<{ bytesBase64Encoded: string }>;
  };
  return Buffer.from(json.predictions[0].bytesBase64Encoded, 'base64');
}

export const generateWithImagen = wrapWithBreaker('google-imagen', call, {
  timeoutMs: config.PROVIDER_TIMEOUT_MS + 5_000,
});
