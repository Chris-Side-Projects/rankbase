import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getSupabase } from '../../services/supabase';
import { validateTurnstile } from '../../middleware/turnstile';
import { requireAuth } from '../../middleware/requireAuth';
import { validateBody } from '../../middleware/validate';
import { AppError, ConflictError } from '../../lib/errors';
import {
  bumpTagCooccurrence,
  getSessionId,
  recordEvent,
  upsertTasteProfile,
} from '../../services/analytics';

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
 * POST /api/vote — record a vote.
 *
 * Calls the cast_vote RPC, which locks both image rows, inserts the vote
 * (the unique constraint dedupes), computes ELO, and updates both rows
 * inside one transaction. This is race-free under concurrent votes for
 * the same image.
 *
 * After a successful vote we fire-and-forget a few analytics writes:
 *   - analytics_events (event_type=vote)
 *   - taste_profiles upsert keyed on session id
 *   - tag_cooccurrence bumps for every pair of tags on the winning image
 *
 * All analytics writes swallow errors; a logging failure must never fail
 * the request.
 *
 * Response on success: 201 with { newWinnerElo, newLoserElo }.
 * Duplicate vote: 409. Invalid UUIDs: 400.
 */
router.post(
  '/',
  requireAuth,
  validateTurnstile,
  validateBody(VoteSchema),
  async (req: Request, res: Response) => {
    const { winnerId, loserId, deviceHash } = req.body as z.infer<typeof VoteSchema>;

    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('cast_vote', {
      p_winner_id: winnerId,
      p_loser_id: loserId,
      p_device_hash: deviceHash,
      p_user_id: req.userId ?? null,
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
    if (!row) {
      throw new AppError({
        status: 500,
        code: 'INTERNAL',
        message: 'cast_vote returned no rows',
        expose: false,
      });
    }

    const sessionId = getSessionId(req);
    const eloDelta = (row.new_winner_elo ?? 0) - (row.new_loser_elo ?? 0);
    void recordEvent({
      sessionId,
      eventType: 'vote',
      imageId: winnerId,
      metadata: { loser_id: loserId, elo_delta: eloDelta },
    });
    void upsertTasteProfile(sessionId);

    // Fetch winning image tags for cooccurrence bumping (best-effort).
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

    res.status(201).json({
      winnerId,
      loserId,
      newWinnerElo: Math.round(row.new_winner_elo),
      newLoserElo: Math.round(row.new_loser_elo),
    });
  }
);

export default router;
