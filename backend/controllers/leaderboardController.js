const User = require('../models/User');
const { rankTitle } = require('../utils/rank');

// GET /api/leaderboard?limit=50 - top users by contest rating, site-wide.
// This is real data (every registered user, ranked by their actual
// contestRating), not the fabricated celebrity-handle demo data a mockup
// might show.
async function getGlobalLeaderboard(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const users = await User.find()
      .select('fullName userId contestRating problemsSolved')
      .sort({ contestRating: -1 })
      .limit(limit);

    const leaderboard = users.map((u, idx) => ({
      rank: idx + 1,
      fullName: u.fullName,
      userId: u.userId,
      contestRating: u.contestRating,
      rankTitle: rankTitle(u.contestRating),
      problemsSolvedCount: u.problemsSolved.length,
    }));

    res.json({ leaderboard });
  } catch (err) {
    next(err);
  }
}

module.exports = { getGlobalLeaderboard };
