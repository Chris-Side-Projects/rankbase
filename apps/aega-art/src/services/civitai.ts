import { wrapWithBreaker } from '@rankbase/core/lib/circuitBreaker';
import { ProviderExhaustedError, UpstreamError } from '@rankbase/core/lib/errors';
import { fetchWithTimeout } from '@rankbase/core/lib/fetchWithTimeout';
import fs from 'fs';

// Load secrets
const secrets = JSON.parse(fs.readFileSync('/home/chris/.openclaw/secrets/image-gen.json', 'utf8'));
const CIVITAI_KEY = secrets.civitai_key;

/**
 * NSFW Civitai models (SDXL, all confirmed NSFW=true, verified version IDs 2026-05-01)
 * Format: urn:air:sdxl:checkpoint:civitai:<modelId>@<versionId>
 * Cost: ~8 Buzz per image at 1024x1024
 */
const NSFW_MODELS = [
  'urn:air:sdxl:checkpoint:civitai:573152@2808677', // LUSTIFY! APEX V8
  'urn:air:sdxl:checkpoint:civitai:82543@2551619', // PornMaster
  'urn:air:sdxl:checkpoint:civitai:897413@2883972', // Big Love
  'urn:air:sdxl:checkpoint:civitai:118111@2767059', // Copax TimeLess
  'urn:air:sdxl:checkpoint:civitai:827184@2883731', // WAI-illustrious-SDXL v17
];

interface WorkflowStep {
  $type: string;
  input: Record<string, unknown>;
  output?: {
    images?: Array<{ url: string; available: boolean }>;
    errors?: unknown[];
  };
  jobs?: Array<{ id: string; status: string }>;
  status?: string;
}

interface WorkflowResponse {
  id: string;
  status: string;
  steps: WorkflowStep[];
  cost?: { total: number };
}

async function call(prompt: string): Promise<Buffer> {
  // Pick a random NSFW model
  const model = NSFW_MODELS[Math.floor(Math.random() * NSFW_MODELS.length)];

  // Submit workflow with wait=90 for inline result
  const submitResponse = await fetchWithTimeout(
    'https://orchestration.civitai.com/v2/consumer/workflows?wait=90',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CIVITAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        steps: [
          {
            $type: 'imageGen',
            input: {
              engine: 'sdcpp',
              ecosystem: 'sdxl',
              operation: 'createImage',
              model,
              prompt,
              negativePrompt: 'worst quality, low quality, blurry, deformed, ugly, watermark, text',
              width: 1024,
              height: 1024,
              cfgScale: 7,
              steps: 25,
            },
          },
        ],
      }),
      timeoutMs: 120000, // 2 min
    }
  );

  if (submitResponse.status === 429 || submitResponse.status === 402) {
    throw new ProviderExhaustedError('civitai', submitResponse.status);
  }

  if (!submitResponse.ok) {
    const body = await submitResponse.text().catch(() => '<unreadable>');
    throw new UpstreamError('civitai', new Error(`${submitResponse.status}: ${body}`));
  }

  let workflow = (await submitResponse.json()) as WorkflowResponse;
  const workflowId = workflow.id;

  // If not complete yet, poll
  const maxAttempts = 20;
  let attempts = 0;
  while (
    workflow.status !== 'succeeded' &&
    workflow.status !== 'failed' &&
    attempts < maxAttempts
  ) {
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const pollResponse = await fetchWithTimeout(
      `https://orchestration.civitai.com/v2/consumer/workflows/${workflowId}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${CIVITAI_KEY}` },
        timeoutMs: 30000,
      }
    );

    if (!pollResponse.ok) {
      const body = await pollResponse.text().catch(() => '<unreadable>');
      throw new UpstreamError('civitai', new Error(`Poll failed ${pollResponse.status}: ${body}`));
    }

    workflow = (await pollResponse.json()) as WorkflowResponse;
  }

  if (workflow.status === 'failed') {
    throw new UpstreamError('civitai', new Error('Workflow failed'));
  }

  // Extract image URL from step output
  const step = workflow.steps?.[0];
  const images = step?.output?.images;
  const imageUrl = images?.find((img) => img.available)?.url ?? images?.[0]?.url;

  if (!imageUrl) {
    throw new UpstreamError('civitai', new Error('No image URL in workflow result'));
  }

  // Download the image
  const imageRes = await fetchWithTimeout(imageUrl, { timeoutMs: 30000 });
  if (!imageRes.ok) {
    throw new UpstreamError('civitai', new Error(`Image download ${imageRes.status}`));
  }

  return Buffer.from(await imageRes.arrayBuffer());
}

export const generateWithCivitai = wrapWithBreaker('civitai', call, {
  timeoutMs: 300000, // 5 minutes
});
