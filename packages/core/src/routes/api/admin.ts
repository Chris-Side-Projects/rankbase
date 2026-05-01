import { getSiteConfig } from '../../siteConfig';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { cronAuth } from '../../middleware/cronAuth';
import { validateBody } from '../../middleware/validate';
import { getSupabase } from '../../services/supabase';
import { AppError, NotFoundError } from '../../lib/errors';

const router: ReturnType<typeof Router> = Router();

// All admin actions require the cron secret. Good enough for a single-operator
// project; migrate to proper user auth once there are real admins.
router.use(cronAuth);

const HideSchema = z.object({
  hidden: z.boolean(),
});

const UuidParamsSchema = z.object({
  id: z.string().uuid(),
});

const ImageListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
  hidden: z.enum(['all', 'visible', 'hidden']).default('all'),
});

const ReportListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['open', 'reviewed', 'dismissed', 'all']).default('open'),
});

const ResolveReportSchema = z.object({
  status: z.enum(['reviewed', 'dismissed']),
});

/**
 * GET /api/admin/reports?status=open|reviewed|dismissed|all
 *
 * Community report queue, joined with the reported image so admins can make
 * a moderation decision without copying IDs around.
 */
router.get('/reports', async (req: Request, res: Response) => {
  const parsed = ReportListQuerySchema.safeParse(req.query);
  if (!parsed.success) throw parsed.error;
  const { limit, offset, status } = parsed.data;

  const supabase = getSupabase();
  let query = supabase
    .from(getSiteConfig().tables.reports)
    .select(
      `
      id,
      image_id,
      reason,
      notes,
      status,
      created_at,
      images (
        id,
        url,
        prompt,
        tags,
        elo,
        votes,
        created_at,
        hidden,
        provider,
        moderation_score
      )
    `
    )
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) {
    throw new AppError({
      status: 500,
      code: 'INTERNAL',
      message: `Admin report query failed: ${error.message}`,
      expose: false,
    });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json({ reports: data ?? [], limit, offset, status });
});

router.post(
  '/reports/:id/resolve',
  validateBody(ResolveReportSchema),
  async (req: Request, res: Response) => {
    const parsed = UuidParamsSchema.safeParse(req.params);
    if (!parsed.success) throw parsed.error;
    const { id } = parsed.data;
    const { status } = req.body as z.infer<typeof ResolveReportSchema>;

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from(getSiteConfig().tables.reports)
      .update({ status, resolved_at: new Date().toISOString() } as any)
      .eq('id', id)
      .select('id, status')
      .single();

    if (error || !data) {
      if (error?.code === 'PGRST116') throw new NotFoundError('Report not found');
      throw new AppError({
        status: 500,
        code: 'INTERNAL',
        message: `Report resolve failed: ${error?.message ?? 'unknown'}`,
        expose: false,
      });
    }

    res.json({ id: (data as any).id, status: (data as any).status });
  }
);

/**
 * GET /api/admin/images?hidden=all|visible|hidden
 *
 * Returns recently generated images with moderation context, sorted so the
 * highest-risk prompts land first in the review queue.
 */
router.get('/images', async (req: Request, res: Response) => {
  const parsed = ImageListQuerySchema.safeParse(req.query);
  if (!parsed.success) throw parsed.error;
  const { limit, offset, hidden } = parsed.data;

  const supabase = getSupabase();
  let query = supabase
    .from(getSiteConfig().tables.images)
    .select('id, url, prompt, tags, elo, votes, created_at, hidden, provider, moderation_score')
    .order('moderation_score', { ascending: false })
    .order('created_at', { ascending: false });

  if (hidden !== 'all') {
    query = query.eq('hidden', hidden === 'hidden');
  }

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) {
    throw new AppError({
      status: 500,
      code: 'INTERNAL',
      message: `Admin image query failed: ${error.message}`,
      expose: false,
    });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json({ images: data ?? [], limit, offset, hidden });
});

/**
 * POST /api/admin/images/:id/moderate
 * Body: { hidden: true }
 *
 * Soft-deletes (hidden=true) or restores (hidden=false) an image. Hidden
 * images are excluded from /compare pair selection and the leaderboard,
 * but votes are preserved so analytics aren't lost.
 *
 * Depends on the `hidden` column added by migration 0002.
 */
router.post(
  '/images/:id/moderate',
  validateBody(HideSchema),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { hidden } = req.body as z.infer<typeof HideSchema>;

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from(getSiteConfig().tables.images)
      .update({ hidden })
      .eq('id', id)
      .select('id, hidden')
      .single();

    if (error || !data) {
      if (error?.code === 'PGRST116') throw new NotFoundError('Image not found');
      throw new AppError({
        status: 500,
        code: 'INTERNAL',
        message: `Moderation failed: ${error?.message ?? 'unknown'}`,
        expose: false,
      });
    }

    res.json({ id: data.id, hidden: data.hidden });
  }
);

/**
 * GET /api/admin/stats — per-provider aggregates.
 *
 * Returns image_count, avg_elo, max_elo, total_votes, hidden_count grouped
 * by provider. Useful for ROI analysis ("is DALL-E worth the spend?") and
 * spotting moderation outliers (a provider with disproportionately many
 * hidden images is worth investigating).
 */
router.get('/stats', async (_req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('admin_provider_stats');
  if (error) {
    throw new AppError({
      status: 500,
      code: 'INTERNAL',
      message: `admin_provider_stats failed: ${error.message}`,
      expose: false,
    });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ providers: data ?? [] });
});

export default router;
