/**
 * Simplified Codeforces-style rating update.
 * Real Codeforces uses a much more elaborate ELO variant; this is a
 * simplified-but-reasonable stand-in: better-than-expected rank vs rating
 * gains, worse-than-expected loses, magnitude scaled by a K-factor.
 *
 * standings: [{ userId, rank }] sorted by rank ascending (1 = best)
 * currentRatings: Map(userId -> rating)
 * Returns Map(userId -> newRating)
 */
function computeRatingUpdates(standings, currentRatings) {
  const K = 32;
  const n = standings.length;
  const updates = new Map();

  standings.forEach(({ userId, rank }) => {
    const myRating = currentRatings.get(String(userId)) ?? 1200;

    // Expected performance: average probability of beating everyone else, via Elo
    let expectedScore = 0;
    standings.forEach((other) => {
      if (String(other.userId) === String(userId)) return;
      const otherRating = currentRatings.get(String(other.userId)) ?? 1200;
      expectedScore += 1 / (1 + Math.pow(10, (otherRating - myRating) / 400));
    });
    expectedScore = n > 1 ? expectedScore / (n - 1) : 0.5;

    // Actual performance based on rank (1st place = 1.0, last place = 0.0)
    const actualScore = n > 1 ? 1 - (rank - 1) / (n - 1) : 0.5;

    const newRating = Math.round(myRating + K * (actualScore - expectedScore));
    updates.set(String(userId), newRating);
  });

  return updates;
}

module.exports = { computeRatingUpdates };
