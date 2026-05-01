/**
 * Standard ELO rating calculation.
 *
 * The ELO system was originally designed for chess ratings. The core idea:
 * - Each player has a numeric rating (default 1000)
 * - When two players compete, the expected outcome is computed from the
 *   rating difference using a logistic curve
 * - The actual outcome (1 for win, 0 for loss) is compared to the expected
 *   outcome, and ratings are adjusted proportionally
 * - The K factor controls how much each game affects ratings (higher K =
 *   more volatile). K=32 is standard for new players in chess.
 *
 * Key property: ELO is zero-sum. The points the winner gains exactly equal
 * the points the loser loses, preserving the total rating pool.
 *
 * @param winnerElo - Current ELO of the winning image
 * @param loserElo  - Current ELO of the losing image
 * @param k         - K-factor (sensitivity). Default 32.
 * @returns New ELO ratings for both images
 */
export function calculateElo(
  winnerElo: number,
  loserElo: number,
  k: number = 32
): { newWinnerElo: number; newLoserElo: number } {
  // Expected score for each player using the logistic curve.
  // When ratings are equal, both expected scores are 0.5.
  // A 400-point advantage gives ~91% expected win probability.
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 - expectedWinner;

  // Actual scores: winner=1, loser=0
  const newWinnerElo = winnerElo + k * (1 - expectedWinner);
  const newLoserElo = loserElo + k * (0 - expectedLoser);

  return { newWinnerElo, newLoserElo };
}
