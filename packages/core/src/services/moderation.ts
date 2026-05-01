import { config } from '../config';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { logger } from '../lib/logger';

/**
 * Calls OpenAI's moderation endpoint to score a piece of text against the
 * standard categories (sexual, violence, hate, etc.).
 *
 * Returns { flagged, score }:
 *   - `flagged` is OpenAI's overall boolean.
 *   - `score` is the maximum category score across the response, useful
 *     for setting a soft threshold (e.g. auto-hide above 0.5 even when
 *     flagged is false but borderline).
 *
 * On failure (network, 5xx, parsing) we return { flagged: false, score: 0 }.
 * Moderation is best-effort: a generation should never fail just because
 * the moderation pre-check couldn't run. The caller can configure a
 * stricter policy if it wants to fail closed.
 */
export async function moderateText(text: string): Promise<{ flagged: boolean; score: number }> {
  if (!config.OPENAI_KEY) return { flagged: false, score: 0 };

  try {
    const response = await fetchWithTimeout('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: text }),
      timeoutMs: 5_000,
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'moderation API non-2xx, defaulting to safe');
      return { flagged: false, score: 0 };
    }

    const json = (await response.json()) as {
      results: Array<{
        flagged: boolean;
        category_scores: Record<string, number>;
      }>;
    };

    const result = json.results[0];
    const score = Math.max(...Object.values(result.category_scores));
    return { flagged: result.flagged, score };
  } catch (err) {
    logger.warn({ err }, 'moderation call failed, defaulting to safe');
    return { flagged: false, score: 0 };
  }
}
