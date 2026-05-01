import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getSupabase } from '../../services/supabase';
import { validateTurnstile } from '../../middleware/turnstile';
import { validateBody } from '../../middleware/validate';
import { AppError, NotFoundError, RateLimitedError } from '../../lib/errors';
import { config } from '../../config';

const router: ReturnType<typeof Router> = Router();

const ImageParamsSchema = z.object({
  id: z.string().uuid(),
});

const ReportSchema = z.object({
  reason: z.enum(['offensive', 'low_quality', 'copyright', 'nsfw', 'other']),
  deviceHash: z.string().min(16).max(256),
  notes: z.string().trim().max(500).optional().default(''),
  'cf-turnstile-response': z.string().optional(),
});

interface VoteRow {
  id: string;
  image_a: string;
  image_b: string;
  winner: string;
  created_at: string;
}

interface ReportDeviceRow {
  device_hash: string;
}

const REPORTS_PER_HOUR_LIMIT = 3;
const AUTO_HIDE_DISTINCT_REPORTERS = 5;

router.post(
  '/:id/report',
  validateTurnstile,
  validateBody(ReportSchema),
  async (req: Request, res: Response) => {
    const parsed = ImageParamsSchema.safeParse(req.params);
    if (!parsed.success) throw parsed.error;
    const { id } = parsed.data;
    const { reason, deviceHash, notes } = req.body as z.infer<typeof ReportSchema>;

    const supabase = getSupabase();
    const { data: image, error: imageError } = await supabase
      .from('aega_images')
      .select('id, hidden')
      .eq('id', id)
      .single();

    if (imageError) {
      if (imageError.code === 'PGRST116') throw new NotFoundError('Image not found');
      throw new AppError({
        status: 500,
        code: 'INTERNAL',
        message: `Image lookup failed: ${imageError.message}`,
        expose: false,
      });
    }
    if (!image) throw new NotFoundError('Image not found');

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from('aega_image_reports')
      .select('id', { count: 'exact', head: true })
      .eq('device_hash', deviceHash)
      .gte('created_at', oneHourAgo);

    if (countError) {
      throw new AppError({
        status: 500,
        code: 'INTERNAL',
        message: `Report rate-limit check failed: ${countError.message}`,
        expose: false,
      });
    }
    if ((count ?? 0) >= REPORTS_PER_HOUR_LIMIT) {
      throw new RateLimitedError('Too many image reports', 3600);
    }

    const { data: report, error: insertError } = await supabase
      .from('aega_image_reports')
      .insert({
        image_id: id,
        reason,
        device_hash: deviceHash,
        notes,
      })
      .select('id, status, created_at')
      .single();

    if (insertError || !report) {
      throw new AppError({
        status: 500,
        code: 'INTERNAL',
        message: `Report insert failed: ${insertError?.message ?? 'unknown'}`,
        expose: false,
      });
    }

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentReports, error: recentError } = await supabase
      .from('aega_image_reports')
      .select('device_hash')
      .eq('image_id', id)
      .eq('status', 'open')
      .gte('created_at', dayAgo);

    if (recentError) {
      throw new AppError({
        status: 500,
        code: 'INTERNAL',
        message: `Report auto-hide check failed: ${recentError.message}`,
        expose: false,
      });
    }

    const distinctReporters = new Set(
      ((recentReports ?? []) as ReportDeviceRow[]).map((row) => row.device_hash)
    ).size;
    const autoHidden = !image.hidden && distinctReporters >= AUTO_HIDE_DISTINCT_REPORTERS;

    if (autoHidden) {
      const { error: hideError } = await supabase
        .from('aega_images')
        .update({ hidden: true })
        .eq('id', id);
      if (hideError) {
        throw new AppError({
          status: 500,
          code: 'INTERNAL',
          message: `Report auto-hide failed: ${hideError.message}`,
          expose: false,
        });
      }
    }

    res.status(201).json({
      report: {
        id: report.id,
        imageId: id,
        reason,
        status: report.status,
        created_at: report.created_at,
      },
      autoHidden,
      distinctReporters,
    });
  }
);

router.get('/:id', async (req: Request, res: Response) => {
  const parsed = ImageParamsSchema.safeParse(req.params);
  if (!parsed.success) throw parsed.error;
  const { id } = parsed.data;

  const supabase = getSupabase();
  const { data: image, error: imageError } = await supabase
    .from('aega_images')
    .select('*')
    .eq('id', id)
    .eq('hidden', false)
    .single();

  if (imageError || !image) {
    if (imageError?.code === 'PGRST116' || !image) throw new NotFoundError('Image not found');
    throw new AppError({
      status: 500,
      code: 'INTERNAL',
      message: `Image lookup failed: ${imageError?.message ?? 'unknown'}`,
      expose: false,
    });
  }

  const { data: votes, error: votesError } = await supabase
    .from('aega_votes')
    .select('id, image_a, image_b, winner, created_at')
    .or(`image_a.eq.${id},image_b.eq.${id}`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (votesError) {
    throw new AppError({
      status: 500,
      code: 'INTERNAL',
      message: `Vote history lookup failed: ${votesError.message}`,
      expose: false,
    });
  }

  const recentVotes = ((votes ?? []) as VoteRow[]).map((vote) => ({
    id: vote.id,
    created_at: vote.created_at,
    won: vote.winner === id,
    opponentId: vote.image_a === id ? vote.image_b : vote.image_a,
  }));

  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30');
  res.json({ image, recentVotes, turnstileSiteKey: config.TURNSTILE_SITE_KEY || null });
});

export default router;
