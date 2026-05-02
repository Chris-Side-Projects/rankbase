import { Router, Request, Response } from 'express';
import { getSupabase } from '../../services/supabase';
import { requireAuth } from '../../middleware/requireAuth';
import { AppError } from '../../lib/errors';

const router: Router = Router();

/**
 * GET /api/votes/history — returns the authenticated user's vote history.
 *
 * Returns the last 50 votes the user cast, including both image URLs and
 * which image they picked as the winner.
 */
router.get('/history', requireAuth, async (req: Request, res: Response) => {
  const supabase = getSupabase();

  const { data: votes, error } = await supabase
    .from('aega_votes')
    .select(
      `
      id,
      winner,
      created_at,
      image_a,
      image_b,
      winner_image:aega_images!aega_votes_winner_fkey(id, url, prompt, elo),
      image_a_data:aega_images!aega_votes_image_a_fkey(id, url, prompt),
      image_b_data:aega_images!aega_votes_image_b_fkey(id, url, prompt)
    `
    )
    .eq('user_id', req.userId!)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    // Fallback: fetch votes then images separately if join fails
    const { data: simpleVotes, error: simpleError } = await supabase
      .from('aega_votes')
      .select('id, winner, image_a, image_b, created_at')
      .eq('user_id', req.userId!)
      .order('created_at', { ascending: false })
      .limit(50);

    if (simpleError) {
      throw new AppError({
        status: 500,
        code: 'INTERNAL',
        message: `Vote history lookup failed: ${simpleError.message}`,
        expose: false,
      });
    }

    const rows = simpleVotes ?? [];
    // Collect all unique image IDs
    const imageIds = [...new Set(rows.flatMap((v: any) => [v.image_a, v.image_b]))];

    const { data: images } = await supabase
      .from('aega_images')
      .select('id, url, prompt, elo')
      .in('id', imageIds);

    const imgMap = Object.fromEntries((images ?? []).map((img: any) => [img.id, img]));

    const history = rows.map((vote: any) => ({
      id: vote.id,
      created_at: vote.created_at,
      winnerId: vote.winner,
      winner: imgMap[vote.winner] ?? null,
      loser: imgMap[vote.image_a === vote.winner ? vote.image_b : vote.image_a] ?? null,
    }));

    res.json({ history });
    return;
  }

  const history = (votes ?? []).map((vote: any) => ({
    id: vote.id,
    created_at: vote.created_at,
    winnerId: vote.winner,
    winner: vote.winner_image ?? null,
    loser: vote.image_a === vote.winner ? (vote.image_b_data ?? null) : (vote.image_a_data ?? null),
  }));

  res.json({ history });
});

export default router;
