/**
 * Simplified Codeforces-style rating update.
 * Real Codeforces uses a much more elaborate ELO variant; this is a
 * simplified-but-reasonable stand-in: better-than-expected performance vs
 * rating gains, worse-than-expected loses, magnitude scaled by a K-factor.
 *
 * standings: [{ userId, rank, solved, totalProblems }] sorted by rank
 *   ascending (1 = best). `solved`/`totalProblems` back the performance
 *   score used below.
 * currentRatings: Map(userId -> rating)
 * Returns Map(userId -> newRating)
 *
 * NOTE: the previous version derived "actual performance" purely from rank
 * relative to other participants (`1 - (rank-1)/(n-1)`), and fell back to a
 * flat 0.5 whenever there was only one participant (n === 1) since there's
 * no one to rank against. That meant a solo participant's rating could
 * never move, no matter how many problems they solved -- 1/1 or 1/2 both
 * left `actualScore === expectedScore === 0.5`, a net-zero update every
 * time. Performance is now grounded in how many of the contest's problems
 * you actually solved (`solved / totalProblems`), which behaves sensibly
 * for both solo and multi-participant contests, and is additionally
 * compared against everyone else's rating (via Elo) when there are other
 * participants to weigh in against.
 */
function computeRatingUpdates(standings, currentRatings) {
  const K = 32;
  const n = standings.length;
  const updates = new Map();

  standings.forEach(({ userId, solved, totalProblems }) => {
    const myRating = currentRatings.get(String(userId)) ?? 1200;

    // How well you actually did, as a fraction of the contest's problems.
    // Solving everything -> 1.0, solving nothing -> 0.0.
    const actualScore = totalProblems > 0 ? solved / totalProblems : 0;

    // Expected performance: baseline "solving half the problems is what a
    // 1200-ish rated user is expected to do" (0.5), refined by an Elo-style
    // comparison against other participants when there are any -- being
    // rated well above the field raises the bar for what counts as "as
    // expected", and vice versa.
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