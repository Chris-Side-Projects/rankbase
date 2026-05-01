import { Router, Request, Response } from 'express';
import { getSupabase } from '../../services/supabase';
import { AppError } from '../../lib/errors';

const router: ReturnType<typeof Router> = Router();

interface ImageRow {
  id: string;
  url: string;
  prompt: string;
  tags: string[];
  elo: number;
  votes: number;
  created_at: string;
  provider: string | null;
}

interface ProviderAccumulator {
  provider: string;
  label: string;
  imageCount: number;
  totalElo: number;
  maxElo: number;
  totalVotes: number;
  topImage: ImageRow | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  stability: 'Stability',
  dalle: 'DALL-E',
  imagen: 'Imagen',
  unknown: 'Unknown',
};

function normalizeProvider(provider: string | null | undefined) {
  return provider?.trim() || 'unknown';
}

function providerLabel(provider: string) {
  return PROVIDER_LABELS[provider] ?? provider;
}

/**
 * GET /api/providers/leaderboard
 *
 * Public, non-admin provider standings. This intentionally excludes hidden
 * images and hidden-count moderation details from the admin stats RPC.
 */
router.get('/leaderboard', async (_req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('aega_images')
    .select('id, url, prompt, tags, elo, votes, created_at, provider')
    .eq('hidden', false)
    .order('elo', { ascending: false })
    .limit(500);

  if (error) {
    throw new AppError({
      status: 500,
      code: 'INTERNAL',
      message: `Provider leaderboard query failed: ${error.message}`,
      expose: false,
    });
  }

  const standings = new Map<string, ProviderAccumulator>();
  for (const image of (data ?? []) as ImageRow[]) {
    const provider = normalizeProvider(image.provider);
    const current =
      standings.get(provider) ??
      ({
        provider,
        label: providerLabel(provider),
        imageCount: 0,
        totalElo: 0,
        maxElo: 0,
        totalVotes: 0,
        topImage: null,
      } satisfies ProviderAccumulator);

    current.imageCount += 1;
    current.totalElo += Number(image.elo ?? 0);
    current.maxElo = Math.max(current.maxElo, Number(image.elo ?? 0));
    current.totalVotes += Number(image.votes ?? 0);
    if (!current.topImage || image.elo > current.topImage.elo) {
      current.topImage = image;
    }
    standings.set(provider, current);
  }

  const providers = Array.from(standings.values())
    .map(({ totalElo, ...provider }) => ({
      ...provider,
      avgElo: provider.imageCount === 0 ? 0 : totalElo / provider.imageCount,
    }))
    .sort((a, b) => b.avgElo - a.avgElo);

  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  res.json({ providers });
});

export default router;
