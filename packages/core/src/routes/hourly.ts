import { getSiteConfig } from '../siteConfig';
import { Router, Request, Response } from 'express';
import { getSupabase } from '../services/supabase';
import { internalError, NotFoundError } from '../lib/errors';

/**
 * Image of the Hour endpoints.
 *
 * GET /api/hourly/current  — the most recent hourly image (the one currently
 *                            featured on the homepage).
 * GET /api/hourly/history  — every hourly image, descending. No pagination
 *                            yet because volume is one row per hour.
 */
const router: ReturnType<typeof Router> = Router();

router.get('/current', async (_req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(getSiteConfig().tables.hourlyImages)
    .select(
      'hour_ts, image:image_id (id, url, prompt, tags, elo, votes, provider, description, style_tags, subject_tags, mood_tags)'
    )
    .order('hour_ts', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw internalError(`hourly current query failed: ${error.message}`);
  if (!data) throw new NotFoundError('No hourly image available yet');

  res.json({ image: data.image, hour_ts: data.hour_ts });
});

router.get('/history', async (_req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(getSiteConfig().tables.hourlyImages)
    .select('hour_ts, image:image_id (id, url, prompt, tags, elo, votes, provider)')
    .order('hour_ts', { ascending: false })
    .limit(500);

  if (error) throw internalError(`hourly history query failed: ${error.message}`);
  res.json({ images: data ?? [] });
});

export default router;
