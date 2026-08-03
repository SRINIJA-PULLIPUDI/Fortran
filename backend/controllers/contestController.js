const Contest = require('../models/Contest');
const Problem = require('../models/Problem');
const TestCase = require('../models/TestCase');
const Submission = require('../models/Submission');
const User = require('../models/User');
const { computeRatingUpdates } = require('../utils/rating');
const { nextProblemNumber } = require('./problemController');

// Ranks a set of users by: contest rating desc, then problems solved desc,
// then acceptance rate desc. Shared by the global leaderboard and (scoped to
// participants + contest-specific solve counts) the per-contest leaderboard,
// per the site's ranking rules.
function rankUsers(entries) {
  return entries
    .slice()
    .sort((a, b) => {
      if (b.contestRating !== a.contestRating) return b.contestRating - a.contestRating;
      if (b.problemsSolved !== a.problemsSolved) return b.problemsSolved - a.problemsSolved;
      return b.acceptanceRate - a.acceptanceRate;
    })
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
}

// GET /api/contests
async function listContests(req, res, next) {
  try {
    const contests = await Contest.find()
      .populate('problems', 'name code number difficulty isPractice')
      .sort({ startTime: -1 });
    res.json({ contests });
  } catch (err) {
    next(err);
  }
}

// POST /api/contests (admin)
// `problems`: array of existing Problem ObjectIds to attach as-is.
// `newProblems`: array of freshly-authored problems (with their own
// testCases/tags/hints) created specifically for this contest. These are
// created as isPractice: false with no display number yet -- they're
// invisible on the public Problems list and their tags/hints are withheld
// (see problemController.getProblem) until the contest is finalized, at
// which point they're promoted into the public bank with the next
// sequential numbers.
async function createContest(req, res, next) {
  try {
    const { title, description, startTime, endTime, problems, newProblems, isRated } = req.body;
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

    if (Array.isArray(newProblems) && newProblems.length > 0) {
      const createdIds = [];
      for (const np of newProblems) {
        if (!np.name || !np.statement || !np.code || !Array.isArray(np.testCases) || np.testCases.length === 0) {
          continue; // skip incomplete entries rather than failing the whole contest
        }
        const problem = await Problem.create({
          name: np.name,
          statement: np.statement,
          code: np.code,
          difficulty: np.difficulty,
          tags: np.tags || [],
          hints: np.hints || [],
          isPractice: false,
          contest: contest._id,
          timeLimitMs: np.timeLimitMs,
          createdBy: req.user._id,
        });
        await TestCase.insertMany(
          np.testCases.map((tc) => ({ problem: problem._id, input: tc.input, output: tc.output, isSample: !!tc.isSample }))
        );
        createdIds.push(problem._id);
      }
      contest.problems.push(...createdIds);
      await contest.save();
    }

    await contest.populate('problems', 'name code number difficulty isPractice');
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
// Ranks contest participants using the same rule as the global leaderboard:
// contest rating desc, then problems solved (in this contest) desc, then
// the user's overall acceptance rate desc.
async function getLeaderboard(req, res, next) {
  try {
    const contestId = req.params.id;
    const submissions = await Submission.find({ contest: contestId, verdict: 'Accepted' })
      .populate('user', 'fullName userId contestRating acceptedSubmissions totalSubmissions')
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
        const totalSubs = s.user.totalSubmissions || 0;
        const acceptedSubs = s.user.acceptedSubmissions || 0;
        perUser.set(uid, {
          user: s.user,
          contestRating: s.user.contestRating,
          acceptanceRate: totalSubs > 0 ? (acceptedSubs / totalSubs) * 100 : 0,
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

    const leaderboard = rankUsers(Array.from(perUser.values()));

    res.json({ leaderboard });
  } catch (err) {
    next(err);
  }
}

// POST /api/contests/:id/finalize (admin) - locks contest, updates ratings,
// and promotes any contest-authored problems into the public practice
// list, assigning them sequential numbers in the order they appear on the
// contest (continuing on from whatever the current highest number is).
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

    // Promote any still-contest-only problems into the public bank.
    const contestProblems = await Problem.find({ _id: { $in: contest.problems }, isPractice: false }).sort({ createdAt: 1 });
    let promoted = 0;
    if (contestProblems.length > 0) {
      let n = await nextProblemNumber();
      for (const p of contestProblems) {
        p.isPractice = true;
        p.number = n;
        n += 1;
        await p.save();
        promoted += 1;
      }
    }

    res.json({ message: 'Contest finalized, ratings updated', updatedUsers: users.length, promotedProblems: promoted });
  } catch (err) {
    next(err);
  }
}

module.exports = { listContests, createContest, registerForContest, getLeaderboard, finalizeContest };