/**
 * Simplified Codeforces-style rating update.
 * Real Codeforces uses a much more elaborate ELO variant; this is a
 * simplified-but-reasonable stand-in: better-than-expected performance vs
 * rating gains, worse-than-expected loses, magnitude scaled by a K-factor.
 *
 * standings: [{ userId, score }] where `score` (0..1) is each user's
 *   contest performance as computed by utils/scoring.js -- it already
 *   accounts for problems solved, solve speed, wrong-submission penalties,
 *   and partial credit, so two users who solved the same number of
 *   problems can still get different rating changes.
 * currentRatings: Map(userId -> rating)
 * Returns Map(userId -> newRating)
 */
function computeRatingUpdates(standings, currentRatings) {
  const K = 32;
  const n = standings.length;
  const updates = new Map();

  standings.forEach(({ userId, score }) => {
    const myRating = currentRatings.get(String(userId)) ?? 1200;
    const actualScore = score;

    // Expected performance: baseline 0.5 (an average performance is "as
    // expected"), refined by an Elo-style comparison against other
    // participants' ratings when there are any -- being rated well above
    // the field raises the bar for what counts as "as expected".
    let expectedScore = 0.5;
    if (n > 1) {
      let sum = 0;
      standings.forEach((other) => {
        if (String(other.userId) === String(userId)) return;
        const otherRating = currentRatings.get(String(other.userId)) ?? 1200;
        sum += 1 / (1 + Math.pow(10, (otherRating - myRating) / 400));
      });
      expectedScore = sum / (n - 1);
    }

    const newRating = Math.round(myRating + K * (actualScore - expectedScore));
    updates.set(String(userId), newRating);
  });

  return updates;
}

module.exports = { computeRatingUpdates };