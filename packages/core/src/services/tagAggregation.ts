import { getSupabase } from './supabase';
import { AppError } from '../lib/errors';

/**
 * Rebuilds the tag_scores materialized table.
 *
 * Idempotent: upserts on the `tag` primary key so re-running after a partial
 * failure is safe. Designed to be invoked either directly (from the HTTP
 * handler when no queue is configured) or as a BullMQ worker job.
 */
export async function aggregateTagScores(): Promise<{ tagsProcessed: number }> {
  const supabase = getSupabase();

  // Exclude moderated images so a hidden image's tags don't pollute scores.
  const { data: images, error } = await supabase
    .from('aega_images')
    .select('elo, tags')
    .eq('hidden', false)
    .not('tags', 'eq', '[]');

  if (error) {
    throw new AppError({
      status: 500,
      code: 'INTERNAL',
      message: `Images query failed: ${error.message}`,
      expose: false,
    });
  }

  if (!images || images.length === 0) return { tagsProcessed: 0 };

  const tagMap = new Map<string, { totalElo: number; count: number }>();
  for (const image of images) {
    const tags = image.tags as string[];
    if (!Array.isArray(tags)) continue;
    for (const tag of tags) {
      const existing = tagMap.get(tag);
      if (existing) {
        existing.totalElo += image.elo;
        existing.count += 1;
      } else {
        tagMap.set(tag, { totalElo: image.elo, count: 1 });
      }
    }
  }

  const rows = Array.from(tagMap.entries()).map(([tag, { totalElo, count }]) => ({
    tag,
    score: totalElo / count,
    image_count: count,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from('tag_scores')
    .upsert(rows, { onConflict: 'tag' });

  if (upsertError) {
    throw new AppError({
      status: 500,
      code: 'INTERNAL',
      message: `Tag scores upsert failed: ${upsertError.message}`,
      expose: false,
    });
  }

  return { tagsProcessed: rows.length };
}
