import { Router, Request, Response } from 'express';
import { getSupabase } from '../services/supabase';
import { selectPair } from '../lib/pairSelection';
import { config } from '../config';
import { AppError } from '../lib/errors';

const router: ReturnType<typeof Router> = Router();

/**
 * GET /compare — renders the server-side voting page (legacy).
 *
 * The SPA (Phase 4b) calls GET /api/compare for JSON instead. This EJS
 * variant is kept for no-JS fallback and for existing bookmarks during
 * the rollout.
 *
 * We fetch the 100 images with the fewest votes, then pick the pair from
 * that window using the uncertainty heuristic. This caps query cost even
 * as the image table grows, while still prioritizing under-compared work.
 */
router.get('/', async (req: Request, res: Response) => {
  const supabase = getSupabase();

  const { data: images, error } = await supabase
    .from('aega_images')
    .select('*')
    .eq('hidden', false)
    .order('votes', { ascending: true })
    .limit(100);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'INTERNAL',
      message: `Compare query failed: ${error.message}`,
      expose: false,
    });
  }

  const pair = selectPair(images ?? []);

  res.render('compare', {
    imageA: pair ? pair[0] : null,
    imageB: pair ? pair[1] : null,
    clientIp: req.ip ?? '0.0.0.0',
    turnstileSiteKey: config.TURNSTILE_SITE_KEY || null,
  });
});

export default router;
