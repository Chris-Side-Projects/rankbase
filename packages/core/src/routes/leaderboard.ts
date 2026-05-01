import { getSiteConfig } from '../siteConfig';
import { Router, Request, Response } from 'express';
import { getSupabase } from '../services/supabase';
import { AppError } from '../lib/errors';

const router: ReturnType<typeof Router> = Router();

/**
 * GET /leaderboard — renders the top-20-by-ELO page (legacy EJS).
 *
 * See /api/leaderboard for the JSON variant used by the SPA.
 */
router.get('/', async (_req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(getSiteConfig().tables.images)
    .select('*')
    .eq('hidden', false)
    .order('elo', { ascending: false })
    .limit(20);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'INTERNAL',
      message: `Leaderboard query failed: ${error.message}`,
      expose: false,
    });
  }

  res.render('leaderboard', { images: data });
});

export default router;
