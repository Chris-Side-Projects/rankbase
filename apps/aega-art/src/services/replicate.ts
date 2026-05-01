import { config } from '../config';
import { ProviderExhaustedError, UpstreamError } from '../lib/errors';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { wrapWithBreaker } from '../lib/circuitBreaker';

/**
 * Generates an image using Replicate (SDXL).
 *
 * Replicate's prediction API is async: POST creates a job, then we poll the
 * GET endpoint until status="succeeded". We pass disable_safety_checker=true
 * because aega.art intentionally allows adult content.
 */

const SDXL_VERSION = '7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc';
const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 40;

interface PredictionResponse {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string[] | string;
  error?: string;
}

async function call(prompt: string): Promise<Buffer> {
  const createRes = await fetchWithTimeout('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.REPLICATE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: SDXL_VERSION,
      input: {
        prompt,
        width: 1024,
        height: 1024,
        disable_safety_checker: true,
      },
    }),
    timeoutMs: config.PROVIDER_TIMEOUT_MS,
  });

  if (createRes.status === 429 || createRes.status === 402) {
    throw new ProviderExhaustedError('Replicate', createRes.status);
  }
  if (!createRes.ok) {
    const body = await createRes.text().catch(() => '<unreadable>');
    throw new UpstreamError('replicate', new Error(`${createRes.status}: ${body}`));
  }

  let prediction = (await createRes.json()) as PredictionResponse;

  for (let i = 0; i < MAX_POLLS && prediction.status !== 'succeeded'; i++) {
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new UpstreamError('replicate', new Error(prediction.error ?? 'prediction failed'));
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const pollRes = await fetchWithTimeout(
      `https://api.replicate.com/v1/predictions/${prediction.id}`,
      {
        headers: { Authorization: `Bearer ${config.REPLICATE_TOKEN}` },
        timeoutMs: config.PROVIDER_TIMEOUT_MS,
      }
    );
    if (!pollRes.ok) {
      throw new UpstreamError('replicate', new Error(`poll ${pollRes.status}`));
    }
    prediction = (await pollRes.json()) as PredictionResponse;
  }

  if (prediction.status !== 'succeeded') {
    throw new ProviderExhaustedError('Replicate', 504, 'replicate poll timeout');
  }

  const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!url) {
    throw new UpstreamError('replicate', new Error('no output url'));
  }

  const imageRes = await fetchWithTimeout(url, { timeoutMs: config.PROVIDER_TIMEOUT_MS });
  if (!imageRes.ok) {
    throw new UpstreamError('replicate', new Error(`image download ${imageRes.status}`));
  }
  return Buffer.from(await imageRes.arrayBuffer());
}

export const generateWithReplicate = wrapWithBreaker('replicate', call, {
  timeoutMs: config.PROVIDER_TIMEOUT_MS * 2,
});
