import { config } from '@rankbase/core/config';
import { fetchWithTimeout } from '@rankbase/core/lib/fetchWithTimeout';
import { logger } from '@rankbase/core/lib/logger';
import fs from 'fs';
import { expandPromptWithGemini } from '@rankbase/core/services/gemini';

// Load secrets
const secrets = JSON.parse(fs.readFileSync('/home/chris/.openclaw/secrets/image-gen.json', 'utf8'));
const DEEPSEEK_KEY = secrets.deepseek_key;

/**
 * DeepSeek text helpers for prompt expansion.
 *
 * Expands short prompts into detailed 60-100 word generation prompts.
 * DeepSeek V3 is uncensored and will handle adult content properly.
 * If DeepSeek fails, we fall back to Gemini 2.5 Flash (SFW framing).
 * If both fail, we return the original short prompt.
 */
const MODEL = 'deepseek-chat';

const EXPANSION_SYSTEM = [
  'You are a creative director for an adult AI image generation platform.',
  'Expand the given short prompt into a rich, detailed 60-100 word prompt for image generation.',
  'Add specific details about pose, lighting, composition, style, mood, color palette, and artistic technique.',
  'Be specific and evocative.',
  'Output ONLY the expanded prompt, nothing else.'
].join(' ');

export async function expandPromptWithDeepSeek(shortPrompt: string): Promise<string> {
  if (!DEEPSEEK_KEY) {
    logger.info('DEEPSEEK_KEY unset, trying Gemini fallback');
    return await expandPromptWithGemini(shortPrompt);
  }

  const url = 'https://api.deepseek.com/chat/completions';
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: EXPANSION_SYSTEM },
          { role: 'user', content: shortPrompt }
        ],
        temperature: 0.9,
        max_tokens: 400,
      }),
      timeoutMs: config.PROVIDER_TIMEOUT_MS,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '<unreadable>');
      logger.warn({ status: res.status, body: body.slice(0, 200) }, 'deepseek expand failed');
      // Fallback to Gemini
      return await expandPromptWithGemini(shortPrompt);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) {
      logger.warn('deepseek expand returned empty text, trying Gemini fallback');
      return await expandPromptWithGemini(shortPrompt);
    }
    return text;
  } catch (err) {
    logger.warn({ err }, 'deepseek expand threw, trying Gemini fallback');
    return await expandPromptWithGemini(shortPrompt);
  }
}