import { getSiteConfig } from '../siteConfig';
import { Router, Request, Response } from 'express';
import { getSupabase } from '../services/supabase';
import { AppError } from '../lib/errors';

const router: ReturnType<typeof Router> = Router();

/**
 * GET /tagboard — renders the top-20-by-tag-score page (legacy EJS).
 *
 * Reads from the materialized tag_scores table (populated nightly by
 * /aggregate-tags) so this stays a single indexed lookup.
 */
router.get('/', async (_req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(getSiteConfig().tables.tagScoresView)
    .select('*')
    .order('score', { ascending: false })
    .limit(20);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'INTERNAL',
      message: `Tagboard query failed: ${error.message}`,
      expose: false,
    });
  }

  res.render('tagboard', { tags: data });
});

export default router;
