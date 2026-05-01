import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { BadRequestError, ForbiddenError, UpstreamError } from '../lib/errors';
import { logger } from '../lib/logger';

/**
 * Validates a Cloudflare Turnstile token against the siteverify endpoint.
 *
 * Turnstile is Cloudflare's CAPTCHA alternative — the browser solves a
 * lightweight challenge and produces a token we verify server-side. Applied
 * to POST /vote to make bot-driven vote stuffing expensive.
 *
 * Skipped entirely when TURNSTILE_SECRET is blank (local dev convenience).
 */
export async function validateTurnstile(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!config.TURNSTILE_SECRET) return next();

  const token = req.body?.['cf-turnstile-response'];
  if (!token || typeof token !== 'string') {
    return next(new BadRequestError('Missing Turnstile token'));
  }

  try {
    const response = await fetchWithTimeout(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: config.TURNSTILE_SECRET, response: token }),
        timeoutMs: config.TURNSTILE_TIMEOUT_MS,
      }
    );

    if (!response.ok) {
      return next(new UpstreamError('turnstile', new Error(`HTTP ${response.status}`)));
    }

    const result = (await response.json()) as { success: boolean; 'error-codes'?: string[] };
    if (!result.success) {
      logger.warn({ codes: result['error-codes'] }, 'turnstile verification failed');
      return next(new ForbiddenError('Turnstile verification failed'));
    }
    next();
  } catch (err) {
    next(new UpstreamError('turnstile', err));
  }
}
