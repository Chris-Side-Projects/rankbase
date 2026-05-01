import { config } from '../config';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { logger } from '../lib/logger';

/**
 * Gemini 2.5 Flash text helpers for aega.art.
 *
 * Used to expand short seed prompts into rich, detailed prompts for image generation.
 * Best-effort: if Gemini fails we fall back to the original short prompt.
 */
const MODEL = 'gemini-2.5-flash';

const EXPANSION_SYSTEM = [
  'You are a creative director for an adult AI image generation platform.',
  'Expand the given short prompt into a rich, detailed 60-100 word prompt for image generation.',
  'Add specific details about pose, lighting, composition, style, mood, color palette, and artistic technique.',
  'Be specific and evocative.',
  'Output ONLY the expanded prompt, nothing else.'
].join(' ');

export async function expandPromptWithGemini(shortPrompt: string): Promise<string> {
  if (!config.GOOGLE_API_KEY) {
    logger.info('GOOGLE_API_KEY unset, skipping prompt expansion');
    return shortPrompt;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${config.GOOGLE_API_KEY}`;
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: EXPANSION_SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: shortPrompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 400 },
      }),
      timeoutMs: config.PROVIDER_TIMEOUT_MS,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '<unreadable>');
      logger.warn({ status: res.status, body: body.slice(0, 200) }, 'gemini expand failed');
      return shortPrompt;
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return shortPrompt;
    return text;
  } catch (err) {
    logger.warn({ err }, 'gemini expand threw');
    return shortPrompt;
  }
}