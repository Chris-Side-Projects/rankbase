import { getSiteConfig } from '../../siteConfig';
import { Router, Request, Response } from 'express';
import { getSupabase } from '../../services/supabase';
import { selectPairExcluding } from '../../lib/pairSelection';
import { config } from '../../config';
import { AppError } from '../../lib/errors';

const router: ReturnType<typeof Router> = Router();

/**
 * GET /api/compare?deviceHash=<hash> — returns an unvoted pair for this device.
 *
 * When deviceHash is provided, already-voted pairs are excluded so the user
 * never sees a CONFLICT. When all pairs are exhausted for this device,
 * returns { pair: null, exhausted: true } so the client can redirect to
 * the leaderboard with a "you've voted on everything!" notice.
 *
 * Response:
 *   { pair: [Image, Image] | null, exhausted: boolean,
 *     turnstileSiteKey: string | null, clientIp: string }
 */
router.get('/', async (req: Request, res: Response) => {
  const supabase = getSupabase();
  const deviceHash = typeof req.query.deviceHash === 'string' ? req.query.deviceHash : null;

  // Fetch candidate images (most-uncertain first)
  const { data: images, error } = await supabase
    .from(getSiteConfig().tables.images)
    .select('*')
    .eq('hidden', false)
    .order('votes', { ascending: true })
    .limit(200);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'INTERNAL',
      message: `Compare query failed: ${error.message}`,
      expose: false,
    });
  }

  const pool = images ?? [];

  // Build set of already-voted pair keys for this device
  const votedPairKeys: Set<string> = new Set();
  if (deviceHash && pool.length >= 2) {
    const { data: voted } = await supabase
      .from(getSiteConfig().tables.votes)
      .select('image_a, image_b')
      .eq('device_hash', deviceHash)
      .limit(5000);

    if (voted && voted.length > 0) {
      for (const v of voted as Array<{ image_a: string; image_b: string }>) {
        const [a, b] = [v.image_a, v.image_b].sort();
        votedPairKeys.add(`${a}:${b}`);
      }
    }
  }

  const pair = selectPairExcluding(pool, votedPairKeys);

  // exhausted = we have enough images but no unvoted pairs left for this device
  const exhausted = pair === null && pool.length >= 2;

  res.setHeader('Cache-Control', 'no-store');
  res.json({
    pair,
    exhausted,
    turnstileSiteKey: config.TURNSTILE_SITE_KEY || null,
    clientIp: req.ip ?? '0.0.0.0',
  });
});

export default router;
