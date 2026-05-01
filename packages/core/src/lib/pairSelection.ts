/**
 * Uncertainty-based pair selection for image comparisons.
 *
 * The goal is to select image pairs that will yield the most information
 * about the true ranking. Two heuristics guide this:
 *
 * 1. **Low vote count** — Images with fewer votes have the most uncertain
 *    ratings. Comparing them first reduces overall uncertainty fastest.
 *
 * 2. **Close ELO** — Comparing images with similar ratings produces more
 *    informative outcomes than mismatches. A 1500-rated image beating a
 *    1000-rated image tells us very little; a 1020 vs 1000 match is much
 *    more revealing.
 *
 * Algorithm:
 * - Pick image A as the one with the fewest votes (most uncertain)
 * - Pick image B as the one closest in ELO to A (most informative match)
 * - This is O(n log n) for the sort + O(n) for the scan, which is fine
 *   for hundreds of images
 */

export interface ImageRow {
  id: string;
  url: string;
  prompt: string;
  tags: string[];
  elo: number;
  votes: number;
  created_at: string;
}

export function selectPair(images: ImageRow[]): [ImageRow, ImageRow] | null {
  return selectPairExcluding(images, new Set());
}

/**
 * Like selectPair but skips any pair whose sorted-UUID key is in votedPairKeys.
 * Returns null when all possible pairs have been voted on (exhausted).
 */
export function selectPairExcluding(
  images: ImageRow[],
  votedPairKeys: Set<string>
): [ImageRow, ImageRow] | null {
  if (images.length < 2) return null;

  // Sort by votes ascending — fewest votes first
  const sorted = [...images].sort((a, b) => a.votes - b.votes);

  // Walk candidates for imageA (fewest votes first); for each A find best B
  // that hasn't been voted on yet.
  for (let ai = 0; ai < sorted.length - 1; ai++) {
    const imageA = sorted[ai];

    // Find best imageB: closest ELO, unvoted pair
    let imageB: ImageRow | null = null;
    let smallestEloDiff = Infinity;

    for (let bi = 0; bi < sorted.length; bi++) {
      if (bi === ai) continue;
      const candidate = sorted[bi];
      const [a, b] = [imageA.id, candidate.id].sort();
      const key = `${a}:${b}`;
      if (votedPairKeys.has(key)) continue;
      const diff = Math.abs(imageA.elo - candidate.elo);
      if (diff < smallestEloDiff) {
        smallestEloDiff = diff;
        imageB = candidate;
      }
    }

    if (imageB) return [imageA, imageB];
    // All partners of imageA are voted — try next imageA
  }

  // All pairs exhausted for this device
  return null;
}
