const Contest = require('../models/Contest');
const Submission = require('../models/Submission');
const User = require('../models/User');
const { computeRatingUpdates } = require('../utils/rating');

// GET /api/contests
async function listContests(req, res, next) {
  try {
    const contests = await Contest.find().sort({ startTime: -1 });
    res.json({ contests });
  } catch (err) {
    next(err);
  }
}

// POST /api/contests (admin)
async function createContest(req, res, next) {
  try {
    const { title, description, startTime, endTime, problems, isRated } = req.body;
    if (!title || !startTime || !endTime) {
      return res.status(400).json({ message: 'title, startTime and endTime are required' });
    }
    const contest = await Contest.create({
      title,
      description,
      startTime,
      endTime,
      problems: problems || [],
      isRated: isRated !== undefined ? isRated : true,
      createdBy: req.user._id,
    });
    res.status(201).json({ contest });
  } catch (err) {
    next(err);
  }
}

// POST /api/contests/:id/register - join a contest
async function registerForContest(req, res, next) {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ message: 'Contest not found' });
    if (!contest.participants.some((p) => String(p) === String(req.user._id))) {
      contest.participants.push(req.user._id);
      await contest.save();
    }
    res.json({ contest });
  } catch (err) {
    next(err);
  }
}

// GET /api/contests/:id/leaderboard
// Ranks by: number of accepted problems desc, then total accepted time asc (classic ICPC-style tiebreak)
async function getLeaderboard(req, res, next) {
  try {
    const contestId = req.params.id;
    const submissions = await Submission.find({ contest: contestId, verdict: 'Accepted' })
      .populate('user', 'fullName userId contestRating')
      .populate('problem', 'name code')
      .sort({ createdAt: 1 });

    // First accepted submission per (user, problem) counts
    const bestByUserProblem = new Map();
    for (const s of submissions) {
      const key = `${s.user._id}_${s.problem._id}`;
      if (!bestByUserProblem.has(key)) bestByUserProblem.set(key, s);
    }

    const perUser = new Map();
    for (const s of bestByUserProblem.values()) {
      const uid = String(s.user._id);
      if (!perUser.has(uid)) {
        perUser.set(uid, {
          user: s.user,
          problemsSolved: 0,
          lastSolvedAt: null,
          solvedProblems: [],
        });
      }
      const entry = perUser.get(uid);
      entry.problemsSolved += 1;
      entry.solvedProblems.push({ problem: s.problem, solvedAt: s.createdAt });
      if (!entry.lastSolvedAt || s.createdAt > entry.lastSolvedAt) entry.lastSolvedAt = s.createdAt;
    }

    const leaderboard = Array.from(perUser.values()).sort((a, b) => {
      if (b.problemsSolved !== a.problemsSolved) return b.problemsSolved - a.problemsSolved;
      return new Date(a.lastSolvedAt) - new Date(b.lastSolvedAt);
    });

    leaderboard.forEach((entry, idx) => (entry.rank = idx + 1));

    res.json({ leaderboard });
  } catch (err) {
    next(err);
  }
}

// POST /api/contests/:id/finalize (admin) - locks contest, updates ratings
async function finalizeContest(req, res, next) {
  try {
    const contest = await Contest.findById(req.params.id);
    if (!contest) return res.status(404).json({ message: 'Contest not found' });

    const submissions = await Submission.find({ contest: contest._id, verdict: 'Accepted' });
    const solvedByUser = new Map();
    submissions.forEach((s) => {
      const uid = String(s.user);
      solvedByUser.set(uid, (solvedByUser.get(uid) || 0) + 1);
    });

    const standings = Array.from(solvedByUser.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([userId], idx) => ({ userId, rank: idx + 1 }));

    const users = await User.find({ _id: { $in: standings.map((s) => s.userId) } });
    const currentRatings = new Map(users.map((u) => [String(u._id), u.contestRating]));

    const updates = computeRatingUpdates(standings, currentRatings);

    for (const user of users) {
      const newRating = updates.get(String(user._id));
      user.ratingHistory.push({ contest: contest._id, rating: newRating, date: new Date() });
      user.contestRating = newRating;
      await user.save();
    }

    res.json({ message: 'Contest finalized, ratings updated', updatedUsers: users.length });
  } catch (err) {
    next(err);
  }
}

module.exports = { listContests, createContest, registerForContest, getLeaderboard, finalizeContest };
