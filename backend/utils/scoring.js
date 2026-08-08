/**
 * Turns a contest's raw submissions into a per-user performance score that
 * actually reflects competitive performance, not just "did they solve it":
 *
 *  - Full credit for an accepted solution, PLUS a speed bonus (up to +30%)
 *    for solving early in the contest window -- solving in the first
 *    minute is worth more than solving with one second left.
 *  - A points penalty for each wrong submission made on a problem before
 *    it was solved (classic competitive-programming penalty).
 *  - Partial credit (capped at half of a full solve) for problems that were
 *    attempted but never fully accepted, scaled by the best fraction of
 *    test cases passed on any single submission -- so "almost got it"
 *    counts for something, but always less than actually solving it.
 *
 * This score (0..1, a fraction of the max possible) is what feeds the Elo
 * rating update in rating.js, so two users who solved the same NUMBER of
 * problems can still end up with different rating changes if one was
 * faster, made fewer wrong attempts, or got further on the problems they
 * didn't finish.
 */

const POINTS_PER_PROBLEM = 100;
const WRONG_SUBMISSION_PENALTY = 10; // points lost per wrong attempt before solving
const MAX_SPEED_BONUS_FRACTION = 0.3; // up to +30% of a problem's points for solving instantly

// submissions: [{ user, problem, verdict, passedTestCases, totalTestCases, createdAt }]
//   (plain objects, ids as strings -- caller maps Mongoose docs down to this)
// problemIds: array of problem id strings that were part of the contest
// contestStart / contestEnd: Date
// Returns Map(userId -> { totalPoints, score (0..1), solved })
function computeContestPerformance({ submissions, problemIds, contestStart, contestEnd }) {
  const durationMs = Math.max(1, new Date(contestEnd) - new Date(contestStart));

  const byUserProblem = new Map();
  submissions.forEach((s) => {
    const key = `${s.user}_${s.problem}`;
    if (!byUserProblem.has(key)) byUserProblem.set(key, []);
    byUserProblem.get(key).push(s);
  });

  const userIds = new Set(submissions.map((s) => s.user));
  const results = new Map();

  userIds.forEach((uid) => {
    let totalPoints = 0;
    let solved = 0;

    problemIds.forEach((pid) => {
      const subs = (byUserProblem.get(`${uid}_${pid}`) || []).slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      if (subs.length === 0) return;

      const acceptedIdx = subs.findIndex((s) => s.verdict === 'Accepted');

      if (acceptedIdx !== -1) {
        solved += 1;
        const wrongBefore = acceptedIdx;
        const solveElapsedMs = new Date(subs[acceptedIdx].createdAt) - new Date(contestStart);
        const timeFraction = Math.min(1, Math.max(0, solveElapsedMs / durationMs));
        const speedMultiplier = 1 + MAX_SPEED_BONUS_FRACTION * (1 - timeFraction); // 1.0 (last second) .. 1.3 (instant)
        const points = POINTS_PER_PROBLEM * speedMultiplier - wrongBefore * WRONG_SUBMISSION_PENALTY;
        // A solved problem is always worth something, even with a heavy
        // penalty -- fully solving it still beats never solving it.
        totalPoints += Math.max(POINTS_PER_PROBLEM * 0.1, points);
      } else {
        const bestRatio = Math.max(0, ...subs.map((s) => (s.totalTestCases > 0 ? s.passedTestCases / s.totalTestCases : 0)));
        const extraWrongAttempts = Math.max(0, subs.length - 1);
        const points = POINTS_PER_PROBLEM * 0.5 * bestRatio - extraWrongAttempts * (WRONG_SUBMISSION_PENALTY * 0.5);
        totalPoints += Math.max(0, points);
      }
    });

    const maxPossible = POINTS_PER_PROBLEM * (1 + MAX_SPEED_BONUS_FRACTION) * problemIds.length;
    results.set(uid, {
      totalPoints: Math.round(totalPoints),
      score: maxPossible > 0 ? totalPoints / maxPossible : 0,
      solved,
    });
  });

  return results;
}

module.exports = { computeContestPerformance };