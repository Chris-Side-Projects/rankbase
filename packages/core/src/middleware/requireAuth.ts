import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { UnauthorizedError } from '../lib/errors';

/**
 * Verifies the Supabase JWT from the Authorization header.
 * Sets req.userId on success.
 *
 * Uses the anon key + Bearer token so Supabase validates the JWT
 * against the project's JWT secret without us needing the secret directly.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Login required to vote'));
  }

  const token = authHeader.slice(7);
  const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return next(new UnauthorizedError('Invalid or expired session — please log in again'));
  }

  req.userId = user.id;
  next();
}
