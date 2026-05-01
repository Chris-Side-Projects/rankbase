import { config } from '../config';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { logger } from '../lib/logger';

/**
 * Multi-model image description pipeline.
 *
 * Sends an image URL to two vision models (OpenAI GPT-4o + Gemini) and
 * returns a merged description plus structured tags (style/subject/mood).
 *
 * Both calls are best-effort. If only one returns we still emit a result;
 * if both fail the caller gets a record with an empty description and
 * empty tag arrays.
 */
export interface ImageDescription {
  description: string;
  models: string[];
  tags: { style: string[]; subject: string[]; mood: string[] };
}

const PROMPT = [
  'Describe this image in 1-2 sentences for an art research database.',
  'Then list tags grouped into three categories: style, subject, mood.',
  'Return strict JSON in this shape: {"description": string, "style": string[], "subject": string[], "mood": string[]}.',
  'Return at most 5 tags per category, lowercase, no duplicates.',
  'Return ONLY the JSON object — no markdown fences, no commentary.',
].join(' ');

interface ParsedDescribe {
  description?: string;
  style?: string[];
  subject?: string[];
  mood?: string[];
}

function safeParse(content: string): ParsedDescribe | null {
  const trimmed = content
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as ParsedDescribe;
  } catch {
    // fall through
  }
  return null;
}

function dedupe(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    if (typeof v !== 'string') continue;
    const norm = v.toLowerCase().trim();
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out.slice(0, 5);
}

async function callOpenAI(imageUrl: string): Promise<ParsedDescribe | null> {
  if (!config.OPENAI_KEY) return null;
  try {
    const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',  // GPT-4.1 — best vision as of 2025
        messages: [
          { role: 'system', content: PROMPT },
          { role: 'user', content: [{ type: 'image_url', image_url: { url: imageUrl } }] },
        ],
        max_tokens: 400,
      }),
      timeoutMs: config.PROVIDER_TIMEOUT_MS,
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'describe: openai call failed');
      return null;
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? '';
    return safeParse(content);
  } catch (err) {
    logger.warn({ err }, 'describe: openai call threw');
    return null;
  }
}

async function callGemini(imageUrl: string): Promise<ParsedDescribe | null> {
  if (!config.GOOGLE_API_KEY) return null;
  try {
    // Fetch the image bytes so we can inline them — Gemini's REST API
    // doesn't follow image URLs directly the way the OpenAI chat API does.
    const imgRes = await fetchWithTimeout(imageUrl, { timeoutMs: config.PROVIDER_TIMEOUT_MS });
    if (!imgRes.ok) {
      logger.warn({ status: imgRes.status }, 'describe: gemini image download failed');
      return null;
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const mimeType = imgRes.headers.get('content-type') ?? 'image/png';

    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.GOOGLE_API_KEY}`,  // Gemini 2.0 Flash
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: mimeType, data: buf.toString('base64') } },
              ],
            },
          ],
        }),
        timeoutMs: config.PROVIDER_TIMEOUT_MS,
      }
    );
    if (!res.ok) {
      logger.warn({ status: res.status }, 'describe: gemini call failed');
      return null;
    }
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const content = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return safeParse(content);
  } catch (err) {
    logger.warn({ err }, 'describe: gemini call threw');
    return null;
  }
}

export async function describeImage(imageUrl: string): Promise<ImageDescription> {
  const [openai, gemini] = await Promise.all([callOpenAI(imageUrl), callGemini(imageUrl)]);

  const models: string[] = [];
  if (openai) models.push('gpt-4.1');
  if (gemini) models.push('gemini-2.5-flash');

  const descriptions = [openai?.description, gemini?.description].filter(
    (d): d is string => typeof d === 'string' && d.trim().length > 0
  );
  // Pick the longer of the two as the canonical description; ties go to OpenAI.
  const description = descriptions.sort((a, b) => b.length - a.length)[0] ?? '';

  const merge = (a: unknown, b: unknown) =>
    dedupe([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]);

  return {
    description,
    models,
    tags: {
      style: merge(openai?.style, gemini?.style),
      subject: merge(openai?.subject, gemini?.subject),
      mood: merge(openai?.mood, gemini?.mood),
    },
  };
}
