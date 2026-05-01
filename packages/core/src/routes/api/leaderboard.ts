import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getSupabase } from '../../services/supabase';
import { AppError } from '../../lib/errors';
import { config } from '../../config';

const router: ReturnType<typeof Router> = Router();

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  period: z.enum(['all', 'week', 'month']).default('all'),
});

/**
 * GET /api/leaderboard?limit=20&offset=0&period=all|week|month
 *
 * Returns: { images: Image[], limit, offset, period }
 *
 * 'all' is the default — uses a direct table scan ordered by ELO.
 * 'week' / 'month' route through the leaderboard_period RPC, which filters
 * to images with at least one vote in the recency window. That keeps the
 * "what's hot lately" view honest: an image with sky-high ELO from
 * months ago shouldn't dominate today's leaderboard if nobody is voting
 * on it anymore.
 */
router.get('/', async (req: Request, res: Response) => {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) throw parsed.error;
  const { limit, offset, period } = parsed.data;

  const supabase = getSupabase();
  let data: unknown[] | null;
  let error: { message: string } | null;

  if (period === 'all') {
    const r = await supabase
      .from('aega_images')
      .select('*')
      .eq('hidden', false)
      .order('elo', { ascending: false })
      .range(offset, offset + limit - 1);
    data = r.data;
    error = r.error;
  } else {
    const r = await supabase.rpc('leaderboard_period', {
      p_period: period,
      p_limit: limit,
      p_offset: offset,
    });
    data = r.data;
    error = r.error;
  }

  if (error) {
    throw new AppError({
      status: 500,
      code: 'INTERNAL',
      message: `Leaderboard query failed: ${error.message}`,
      expose: false,
    });
  }

  // Recency leaderboard moves slowly enough to cache shortly; full leaderboard
  // can cache a bit longer.
  res.setHeader(
    'Cache-Control',
    period === 'all' ? 'public, max-age=30, s-maxage=30' : 'public, max-age=60, s-maxage=60'
  );
  res.json({
    images: data ?? [],
    limit,
    offset,
    period,
    turnstileSiteKey: config.TURNSTILE_SITE_KEY || null,
  });
});

export default router;
