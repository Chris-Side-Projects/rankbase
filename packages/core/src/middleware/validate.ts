import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Zod-backed request body validator.
 *
 * Usage in a route:
 *   router.post('/', validateBody(VoteSchema), async (req, res) => { ... })
 *
 * On success, `req.body` is replaced with the parsed object (so TypeScript
 * types downstream are the inferred Zod type). On failure, we throw the
 * ZodError and let the global error handler format it.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };
}
