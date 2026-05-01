import { Router, Request, Response } from 'express';
import { getSupabase } from '../services/supabase';
import { internalError } from '../lib/errors';

/**
 * Analytics endpoints. All read-only, no auth — these surface aggregate
 * statistics meant for an embedded research dashboard.
 *
 * Most endpoints are intentionally simple Supabase queries; if/when these
 * grow beyond a few hundred ms we'll move them to materialized views.
 */
const router: ReturnType<typeof Router> = Router();

router.get('/prompts', async (_req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('aega_images')
    .select('prompt, elo, votes')
    .order('votes', { ascending: false })
    .limit(100);
  if (error) throw internalError(`prompts query failed: ${error.message}`);

  const byPrompt = new Map<string, { prompt: string; votes: number; elo_sum: number; n: number }>();
  for (const row of (data as any[]) ?? []) {
    const key = row.prompt;
    const entry = byPrompt.get(key) ?? { prompt: key, votes: 0, elo_sum: 0, n: 0 };
    entry.votes += row.votes ?? 0;
    entry.elo_sum += row.elo ?? 0;
    entry.n += 1;
    byPrompt.set(key, entry);
  }
  const prompts = Array.from(byPrompt.values())
    .map((e) => ({ prompt: e.prompt, votes: e.votes, avg_elo: e.n ? e.elo_sum / e.n : 0 }))
    .sort((a, b) => b.votes - a.votes);

  res.json({ prompts });
});

router.get('/tags', async (_req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('aega_images').select('tags, elo');
  if (error) throw internalError(`tags query failed: ${error.message}`);

  const byTag = new Map<string, { tag: string; count: number; elo_sum: number }>();
  for (const row of (data as any[]) ?? []) {
    const tags = (row.tags as string[] | null) ?? [];
    for (const tag of tags) {
      const entry = byTag.get(tag) ?? { tag, count: 0, elo_sum: 0 };
      entry.count += 1;
      entry.elo_sum += row.elo ?? 0;
      byTag.set(tag, entry);
    }
  }
  const tags = Array.from(byTag.values())
    .map((e) => ({ tag: e.tag, count: e.count, avg_elo: e.count ? e.elo_sum / e.count : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 200);

  res.json({ tags });
});

router.get('/tag-network', async (_req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('aega_tag_cooccurrence')
    .select('tag_a, tag_b, count')
    .order('count', { ascending: false })
    .limit(500);
  if (error) throw internalError(`tag-network query failed: ${error.message}`);

  const nodeSet = new Set<string>();
  for (const row of (data as any[]) ?? []) {
    nodeSet.add(row.tag_a);
    nodeSet.add(row.tag_b);
  }
  res.json({
    nodes: Array.from(nodeSet).map((id) => ({ id })),
    edges: ((data as any[]) ?? []).map((row: any) => ({ source: row.tag_a, target: row.tag_b, weight: row.count })),
  });
});

router.get('/taste-profiles', async (_req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('aega_taste_profiles')
    .select('id, session_id, vote_count, created_at, updated_at')
    .order('vote_count', { ascending: false })
    .limit(100);
  if (error) throw internalError(`taste-profiles query failed: ${error.message}`);

  const { data: edgeData } = await supabase
    .from('aega_taste_edges')
    .select('profile_a, profile_b, weight')
    .order('weight', { ascending: false })
    .limit(500);

  res.json({ profiles: data ?? [], edges: edgeData ?? [] });
});

router.get('/elo-distribution', async (_req: Request, res: Response) => {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('aega_images').select('elo');
  if (error) throw internalError(`elo-distribution query failed: ${error.message}`);

  // Bucket ELO into 50-point bins.
  const buckets = new Map<number, number>();
  for (const row of (data as any[]) ?? []) {
    const elo = row.elo ?? 0;
    const bucket = Math.floor(elo / 50) * 50;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  const histogram = Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bucket, count]) => ({ bucket, count }));

  res.json({ histogram, total: data?.length ?? 0 });
});

export default router;
