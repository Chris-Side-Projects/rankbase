import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';

/**
 * Validates the shared-secret Bearer token required for cron-triggered
 * endpoints (POST /generate, POST /aggregate-tags).
 *
 * Without this anyone could spam /generate to burn real provider credits.
 * Callers (the crontab curl invocation) include:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Skipped if CRON_SECRET is empty so local dev doesn't need the header.
 */
export function cronAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!config.CRON_SECRET) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing Authorization header'));
  }

  const token = authHeader.slice(7);
  if (token !== config.CRON_SECRET) {
    return next(new ForbiddenError('Invalid cron secret'));
  }

  next();
}
