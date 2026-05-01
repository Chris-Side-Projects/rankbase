import { wrapWithBreaker } from '../lib/circuitBreaker';
import { ProviderExhaustedError, UpstreamError } from '../lib/errors';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import fs from 'fs';

// Load secrets
const secrets = JSON.parse(fs.readFileSync('/home/chris/.openclaw/secrets/image-gen.json', 'utf8'));
const GETIMG_KEY = secrets.getimg_key;

/**
 * Generates an image using getimg.ai v2 API.
 *
 * Uses Seedream 5.0 Lite — best quality/cost balance available on v2.
 * Response includes a short-lived download URL; we fetch the bytes immediately.
 */
interface GetImgV2Response {
  id: string;
  status: string;
  data: Array<{ url: string; width: number; height: number; mime_type: string }>;
  usage?: { total_cost: number };
}

async function call(prompt: string): Promise<Buffer> {
  const response = await fetchWithTimeout('https://api.getimg.ai/v2/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GETIMG_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'seedream-5-lite',
      prompt,
      aspect_ratio: '1:1',
    }),
    timeoutMs: 60000,
  });

  if (response.status === 429 || response.status === 402) {
    throw new ProviderExhaustedError('getimg.ai', response.status);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new UpstreamError('getimg', new Error(`${response.status}: ${body}`));
  }

  const json = (await response.json()) as GetImgV2Response;
  const url = json.data?.[0]?.url;
  if (!url) {
    throw new UpstreamError('getimg', new Error('GetImg v2 response missing data url'));
  }

  // Fetch the actual image bytes from the short-lived download URL
  const imgRes = await fetchWithTimeout(url, { method: 'GET', timeoutMs: 30000 });
  if (!imgRes.ok) {
    throw new UpstreamError('getimg', new Error(`image download failed: ${imgRes.status}`));
  }
  return Buffer.from(await imgRes.arrayBuffer());
}

export const generateWithGetImg = wrapWithBreaker('getimg', call, {
  timeoutMs: 35000,
});