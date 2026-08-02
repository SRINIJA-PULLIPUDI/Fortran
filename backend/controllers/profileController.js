const User = require('../models/User');
const { rankTitle, currentStreak } = require('../utils/rank');

// GET /api/profile/:userId - public profile with streak map, rating graph, stats
async function getProfile(req, res, next) {
  try {
    const user = await User.findOne({ userId: req.params.userId })
      .select('-password')
      .populate('problemsSolved', 'name code difficulty');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      profile: {
        fullName: user.fullName,
        userId: user.userId,
        email: user.email,
        problemsSolvedCount: user.problemsSolved.length,
        problemsSolved: user.problemsSolved,
        acceptanceRate: user.acceptanceRate(),
        totalSubmissions: user.totalSubmissions,
        acceptedSubmissions: user.acceptedSubmissions,
        contestRating: user.contestRating,
        rankTitle: rankTitle(user.contestRating),
        currentStreak: currentStreak(user.activityLog),
        ratingHistory: user.ratingHistory,
        activityLog: user.activityLog, // [{date: 'YYYY-MM-DD', count}] - frontend renders as a heatmap
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile };
