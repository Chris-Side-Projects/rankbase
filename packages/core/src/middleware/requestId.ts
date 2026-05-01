import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Attaches a stable request ID to every request for log correlation.
 *
 * If the upstream (nginx, Cloudflare, another service) already set an
 * X-Request-Id header we respect it — otherwise we mint a fresh UUID v4.
 * We echo it back on the response so clients can reference it in bug reports.
 *
 * Downstream middleware and handlers read it via `req.id`.
 */

// eslint-disable-next-line @typescript-eslint/no-namespace
declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const id = incoming && incoming.length <= 128 ? incoming : randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}
