import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { captureError } from '../lib/sentry';

/**
 * Catches anything that falls through the route handlers and turns it into a
 * consistent JSON response. All error responses share this shape:
 *
 *   {
 *     "error": { "code": "BAD_REQUEST", "message": "...", "details": {...} },
 *     "requestId": "uuid"
 *   }
 *
 * The requestId lets a user quote it when reporting a bug so we can find the
 * correlated log line immediately.
 *
 * We pick an HTTP status from AppError.status; unknown errors map to 500 and
 * we never leak their message (could contain stack, internal hostnames, etc.).
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  // Zod validation errors get flattened into a client-friendly shape.
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'Invalid request body', details },
      requestId: req.id,
    });
    return;
  }

  if (err instanceof AppError) {
    const body = {
      error: {
        code: err.code,
        message: err.expose ? err.message : 'Internal server error',
        ...(err.details ? { details: err.details } : {}),
      },
      requestId: req.id,
    };

    // Log server-side failures with the original error object so Pino
    // captures the stack. Client errors log at warn with just the message.
    if (err.status >= 500) {
      logger.error({ err, reqId: req.id }, `AppError ${err.code}`);
      captureError(err, { reqId: req.id, code: err.code });
    } else {
      logger.warn({ code: err.code, reqId: req.id, details: err.details }, err.message);
    }
    res.status(err.status).json(body);
    return;
  }

  // Unknown error — never expose.
  logger.error({ err, reqId: req.id }, 'Unhandled error');
  captureError(err, { reqId: req.id });
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Internal server error' },
    requestId: req.id,
  });
}

/**
 * 404 fallthrough for routes the router didn't match.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
    requestId: req.id,
  });
}
