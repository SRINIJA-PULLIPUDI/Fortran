const Problem = require('../models/Problem');
const TestCase = require('../models/TestCase');
const Submission = require('../models/Submission');
const User = require('../models/User');

// GET /api/problems - list all practice + visible problems, with real
// acceptance % computed from actual submissions (not a fabricated number)
async function listProblems(req, res, next) {
  try {
    const problems = await Problem.find({ isPractice: true }).select('name code difficulty tags createdAt').sort({ createdAt: -1 });

    const stats = await Submission.aggregate([
      { $match: { problem: { $in: problems.map((p) => p._id) }, verdict: { $nin: ['Queued', 'Running'] } } },
      {
        $group: {
          _id: '$problem',
          total: { $sum: 1 },
          accepted: { $sum: { $cond: [{ $eq: ['$verdict', 'Accepted'] }, 1, 0] } },
        },
      },
    ]);
    const statsByProblem = new Map(stats.map((s) => [String(s._id), s]));

    const solvedIds = req.user
      ? new Set((await User.findById(req.user._id).select('problemsSolved')).problemsSolved.map(String))
      : new Set();

    const enriched = problems.map((p) => {
      const s = statsByProblem.get(String(p._id));
      const acceptanceRate = s && s.total > 0 ? Number(((s.accepted / s.total) * 100).toFixed(1)) : null;
      return { ...p.toObject(), acceptanceRate, totalSubmissions: s?.total || 0, solvedByMe: solvedIds.has(String(p._id)) };
    });

    res.json({ problems: enriched });
  } catch (err) {
    next(err);
  }
}

// GET /api/problems/:code - problem detail + sample test cases only
async function getProblem(req, res, next) {
  try {
    const problem = await Problem.findOne({ code: req.params.code });
    if (!problem) return res.status(404).json({ message: 'Problem not found' });

    const samples = await TestCase.find({ problem: problem._id, isSample: true }).select('input output');
    res.json({ problem, samples });
  } catch (err) {
    next(err);
  }
}

// POST /api/problems (admin) - create a problem with test cases
async function createProblem(req, res, next) {
  try {
    const { name, statement, code, difficulty, tags, isPractice, timeLimitMs, testCases } = req.body;
    if (!name || !statement || !code || !Array.isArray(testCases) || testCases.length === 0) {
      return res.status(400).json({ message: 'name, statement, code and at least one testCase are required' });
    }

    const problem = await Problem.create({
      name,
      statement,
      code,
      difficulty,
      tags,
      isPractice,
      timeLimitMs,
      createdBy: req.user._id,
    });

    const docs = testCases.map((tc) => ({
      problem: problem._id,
      input: tc.input,
      output: tc.output,
      isSample: !!tc.isSample,
    }));
    await TestCase.insertMany(docs);

    res.status(201).json({ problem });
  } catch (err) {
    next(err);
  }
}

module.exports = { listProblems, getProblem, createProblem };
