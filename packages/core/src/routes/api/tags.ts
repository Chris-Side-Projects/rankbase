import { getSiteConfig } from '../../siteConfig';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getSupabase } from '../../services/supabase';
import { AppError } from '../../lib/errors';
import { config } from '../../config';

const router: ReturnType<typeof Router> = Router();

const ParamsSchema = z.object({
  tag: z.string().trim().min(1).max(80),
});

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get('/:tag/images', async (req: Request, res: Response) => {
  const params = ParamsSchema.safeParse(req.params);
  if (!params.success) throw params.error;
  const query = QuerySchema.safeParse(req.query);
  if (!query.success) throw query.error;

  const { tag } = params.data;
  const { limit, offset } = query.data;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(getSiteConfig().tables.images)
    .select('*')
    .eq('hidden', false)
    .contains('tags', [tag])
    .order('elo', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'INTERNAL',
      message: `Tag image query failed: ${error.message}`,
      expose: false,
    });
  }

  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  res.json({
    tag,
    images: data ?? [],
    limit,
    offset,
    turnstileSiteKey: config.TURNSTILE_SITE_KEY || null,
  });
});

export default router;
