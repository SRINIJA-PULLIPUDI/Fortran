const User = require('../models/User');
const { rankTitle } = require('../utils/rank');

// GET /api/leaderboard?limit=50 - every registered user, ranked by:
//   1. contest rating (desc)
//   2. problems solved (desc), if rating ties
//   3. acceptance rate (desc), if problems solved also ties
async function getGlobalLeaderboard(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    // Rank needs to be computed across the full user base (rating alone
    // isn't a unique sort key), so fetch everyone, sort with the full
    // tiebreak rule in application code, then slice to `limit`.
    // Admin accounts are problem setters, not competitors -- they can still
    // solve problems (useful for testing), but never appear on a public
    // leaderboard.
    const users = await User.find({ role: { $ne: 'admin' } }).select(
      'fullName userId contestRating problemsSolved acceptedSubmissions totalSubmissions'
    );

    const ranked = users
      .map((u) => ({
        fullName: u.fullName,
        userId: u.userId,
        contestRating: u.contestRating,
        problemsSolvedCount: u.problemsSolved.length,
        acceptanceRate: u.totalSubmissions > 0 ? (u.acceptedSubmissions / u.totalSubmissions) * 100 : 0,
      }))
      .sort((a, b) => {
        if (b.contestRating !== a.contestRating) return b.contestRating - a.contestRating;
        if (b.problemsSolvedCount !== a.problemsSolvedCount) return b.problemsSolvedCount - a.problemsSolvedCount;
        return b.acceptanceRate - a.acceptanceRate;
      })
      .slice(0, limit)
      .map((entry, idx) => ({ ...entry, rank: idx + 1, rankTitle: rankTitle(entry.contestRating) }));

    res.json({ leaderboard: ranked });
  } catch (err) {
    next(err);
  }
}

module.exports = { getGlobalLeaderboard };