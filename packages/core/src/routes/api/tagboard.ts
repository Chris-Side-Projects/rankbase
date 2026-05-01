import { getSiteConfig } from '../../siteConfig';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getSupabase } from '../../services/supabase';
import { AppError } from '../../lib/errors';

const router: ReturnType<typeof Router> = Router();

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get('/', async (req: Request, res: Response) => {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) throw parsed.error;
  const { limit, offset } = parsed.data;

  const supabase = getSupabase();
  // tag_scores_live is a Postgres view that computes scores in real-time
  // from aega_images — no nightly aggregation needed.
  const { data, error } = await supabase
    .from(getSiteConfig().tables.tagScoresView)
    .select('tag, score, image_count')
    .order('score', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'INTERNAL',
      message: `Tagboard query failed: ${error.message}`,
      expose: false,
    });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json({ tags: data ?? [], limit, offset });
});

export default router;
