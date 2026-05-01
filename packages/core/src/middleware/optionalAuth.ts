import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

/**
 * Optional auth middleware — sets req.userId when a valid Bearer token is present
 * but does NOT block the request if absent or invalid.
 *
 * Use on routes that benefit from knowing who the user is but allow anonymous access.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7);
  try {
    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      req.userId = user.id;
    }
  } catch {
    // Ignore auth errors — treat as anonymous
  }

  next();
}
