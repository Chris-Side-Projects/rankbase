import { Request } from 'express';
import { getSupabase } from './supabase';
import { logger } from '../lib/logger';

/**
 * Lightweight analytics helpers. All writes are best-effort: a failure here
 * must NEVER fail a request, so the helpers swallow errors and log them.
 */

export function getSessionId(req: Request): string | null {
  const headerVal = req.header('X-Session-ID');
  if (headerVal) return headerVal;
  const cookieSession =
    typeof (req as { cookies?: Record<string, string> }).cookies?.session_id === 'string'
      ? (req as { cookies?: Record<string, string> }).cookies!.session_id
      : null;
  return cookieSession;
}

export async function recordEvent(opts: {
  sessionId: string | null;
  eventType: string;
  imageId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.from('aega_analytics_events').insert({
      session_id: opts.sessionId,
      event_type: opts.eventType,
      image_id: opts.imageId,
      metadata: opts.metadata ?? {},
    });
  } catch (err) {
    logger.warn({ err }, 'analytics_events insert failed');
  }
}

export async function upsertTasteProfile(sessionId: string | null): Promise<void> {
  if (!sessionId) return;
  try {
    const supabase = getSupabase();
    // Try the atomic RPC first; if the project hasn't installed it we fall
    // back to a non-atomic read-then-write.
    const rpcRes = await supabase.rpc('upsert_taste_profile', { p_session_id: sessionId });
    if (!rpcRes.error) return;

    const { data: existing } = await supabase
      .from('aega_taste_profiles')
      .select('id, vote_count')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (existing) {
      await supabase
        .from('aega_taste_profiles')
        .update({
          vote_count: (existing.vote_count ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('aega_taste_profiles').insert({ session_id: sessionId, vote_count: 1 });
    }
  } catch (err) {
    logger.warn({ err }, 'upsertTasteProfile failed');
  }
}

export async function bumpTagCooccurrence(tags: string[]): Promise<void> {
  if (!tags || tags.length < 2) return;
  try {
    const supabase = getSupabase();
    const sorted = [...new Set(tags)].sort();
    const pairs: Array<{ tag_a: string; tag_b: string }> = [];
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        pairs.push({ tag_a: sorted[i], tag_b: sorted[j] });
      }
    }
    if (pairs.length === 0) return;

    // Try the atomic RPC; fall back to a per-pair read-then-write loop. That
    // loop is cheap in practice — aega.art images carry only a handful of
    // tags so the inner pair count is typically <30.
    const rpcRes = await supabase.rpc('bump_tag_cooccurrence', { pairs });
    if (!rpcRes.error) return;

    for (const pair of pairs) {
      const { data: existing } = await supabase
        .from('aega_tag_cooccurrence')
        .select('count')
        .eq('tag_a', pair.tag_a)
        .eq('tag_b', pair.tag_b)
        .maybeSingle();
      if (existing) {
        await supabase
          .from('aega_tag_cooccurrence')
          .update({ count: (existing.count ?? 0) + 1 })
          .eq('tag_a', pair.tag_a)
          .eq('tag_b', pair.tag_b);
      } else {
        await supabase
          .from('aega_tag_cooccurrence')
          .insert({ tag_a: pair.tag_a, tag_b: pair.tag_b, count: 1 });
      }
    }
  } catch (err) {
    logger.warn({ err }, 'bumpTagCooccurrence failed');
  }
}
