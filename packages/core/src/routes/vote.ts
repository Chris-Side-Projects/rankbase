import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getSupabase } from '../services/supabase';
import { validateTurnstile } from '../middleware/turnstile';
import { validateBody } from '../middleware/validate';
import { AppError, ConflictError } from '../lib/errors';
import {
  bumpTagCooccurrence,
  getSessionId,
  recordEvent,
  upsertTasteProfile,
} from '../services/analytics';

const router: ReturnType<typeof Router> = Router();

const UuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid UUID');

const VoteSchema = z
  .object({
    winnerId: UuidSchema,
    loserId: UuidSchema,
    deviceHash: z.string().min(16).max(256),
    'cf-turnstile-response': z.string().optional(),
  })
  .refine((v) => v.winnerId !== v.loserId, {
    message: 'winnerId and loserId must be different',
    path: ['loserId'],
  });

/**
 * POST /vote — legacy server-rendered vote endpoint. Same atomic RPC as
 * /api/vote; the only difference is the redirect-back-to-/compare flow
 * for non-JS clients.
 *
 * Mirrors the analytics writes from /api/vote.
 */
router.post(
  '/',
  validateTurnstile,
  validateBody(VoteSchema),
  async (req: Request, res: Response) => {
    const { winnerId, loserId, deviceHash } = req.body as z.infer<typeof VoteSchema>;

    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('cast_vote', {
      p_winner_id: winnerId,
      p_loser_id: loserId,
      p_device_hash: deviceHash,
    });

    if (error) {
      if (error.code === '23505') throw new ConflictError('Already voted on this pair');
      if (error.code === 'P0002') {
        throw new AppError({
          status: 404,
          code: 'NOT_FOUND',
          message: 'One or both images not found',
        });
      }
      throw new AppError({
        status: 500,
        code: 'INTERNAL',
        message: `cast_vote RPC failed: ${error.message}`,
        expose: false,
      });
    }

    const row = Array.isArray(data) ? data[0] : data;
    const sessionId = getSessionId(req);
    const eloDelta = row ? (row.new_winner_elo ?? 0) - (row.new_loser_elo ?? 0) : 0;
    void recordEvent({
      sessionId,
      eventType: 'vote',
      imageId: winnerId,
      metadata: { loser_id: loserId, elo_delta: eloDelta },
    });
    void upsertTasteProfile(sessionId);
    void supabase
      .from('aega_images')
      .select('tags, style_tags, subject_tags, mood_tags')
      .eq('id', winnerId)
      .maybeSingle()
      .then(({ data: img }: { data: any }) => {
        const all = [
          ...((img?.tags as string[] | null) ?? []),
          ...((img?.style_tags as string[] | null) ?? []),
          ...((img?.subject_tags as string[] | null) ?? []),
          ...((img?.mood_tags as string[] | null) ?? []),
        ];
        return bumpTagCooccurrence(all);
      });

    res.redirect('/compare');
  }
);

export default router;
