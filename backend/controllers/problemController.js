const Problem = require('../models/Problem');
const TestCase = require('../models/TestCase');
const Submission = require('../models/Submission');
const User = require('../models/User');
const Contest = require('../models/Contest');

// Assigns the next sequential display number, continuing from whatever the
// highest currently-assigned number is. Used both for problems created
// directly (immediately public) and for contest problems being promoted
// into the public list when their contest is finalized.
async function nextProblemNumber() {
  const top = await Problem.findOne({ number: { $ne: null } }).sort('-number').select('number');
  return (top?.number || 0) + 1;
}

// GET /api/problems - list all publicly-visible (practice) problems, with
// real acceptance % computed from actual submissions, and optional
// filtering by difficulty, topic tag, minimum acceptance %, or exact
// problem number.
async function listProblems(req, res, next) {
  try {
    const filter = { isPractice: true };
    if (req.query.difficulty && req.query.difficulty !== 'All') filter.difficulty = req.query.difficulty;
    if (req.query.number) filter.number = Number(req.query.number);
    if (req.query.tags) {
      const tags = String(req.query.tags)
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (tags.length) filter.tags = { $in: tags };
    }

    const problems = await Problem.find(filter).select('name code number difficulty tags createdAt').sort({ number: 1 });

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

    let enriched = problems.map((p) => {
      const s = statsByProblem.get(String(p._id));
      const acceptanceRate = s && s.total > 0 ? Number(((s.accepted / s.total) * 100).toFixed(1)) : null;
      return { ...p.toObject(), acceptanceRate, totalSubmissions: s?.total || 0, solvedByMe: solvedIds.has(String(p._id)) };
    });

    // Acceptance is a derived/aggregated value, not a raw DB field, so the
    // minAcceptance filter is applied here rather than in the Mongo query.
    if (req.query.minAcceptance) {
      const min = Number(req.query.minAcceptance);
      enriched = enriched.filter((p) => p.acceptanceRate !== null && p.acceptanceRate >= min);
    }

    res.json({ problems: enriched });
  } catch (err) {
    next(err);
  }
}

// GET /api/problems/:code - problem detail + sample test cases.
// Contest-authored problems that haven't been promoted into the public list
// yet (isPractice: false, still awaiting contest finalization) have their
// topic tags and hints withheld -- those are only meant to be visible once
// the contest is over and the problem joins the practice bank.
async function getProblem(req, res, next) {
  try {
    const problem = await Problem.findOne({ code: req.params.code });
    if (!problem) return res.status(404).json({ message: 'Problem not found' });

    const samples = await TestCase.find({ problem: problem._id, isSample: true }).select('input output');

    const problemJson = problem.toObject();
    if (!problem.isPractice) {
      delete problemJson.tags;
      delete problemJson.hints;
    }

    res.json({ problem: problemJson, samples });
  } catch (err) {
    next(err);
  }
}

// POST /api/problems (admin) - create a problem with test cases. Standalone
// problems (not tied to a contest) go straight into the public practice
// list and get the next sequential number immediately.
async function createProblem(req, res, next) {
  try {
    const { name, statement, code, difficulty, tags, hints, isPractice, timeLimitMs, testCases } = req.body;
    if (!name || !statement || !code || !Array.isArray(testCases) || testCases.length === 0) {
      return res.status(400).json({ message: 'name, statement, code and at least one testCase are required' });
    }

    const practice = isPractice !== undefined ? isPractice : true;

    const problem = await Problem.create({
      name,
      statement,
      code,
      difficulty,
      tags,
      hints: hints || [],
      isPractice: practice,
      number: practice ? await nextProblemNumber() : undefined,
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

// GET /api/problems/:code/edit (admin) - full problem detail including ALL
// test cases (not just samples), for pre-filling the edit form.
async function getProblemForEdit(req, res, next) {
  try {
    const problem = await Problem.findOne({ code: req.params.code });
    if (!problem) return res.status(404).json({ message: 'Problem not found' });
    const testCases = await TestCase.find({ problem: problem._id }).select('input output isSample');
    res.json({ problem, testCases });
  } catch (err) {
    next(err);
  }
}

// PUT /api/problems/:code (admin) - update a problem's fields. If
// `testCases` is provided, it fully replaces the existing set (simplest way
// to fix a wrong expected-output value or add/remove a case).
async function updateProblem(req, res, next) {
  try {
    const problem = await Problem.findOne({ code: req.params.code });
    if (!problem) return res.status(404).json({ message: 'Problem not found' });

    const { name, statement, difficulty, tags, hints, timeLimitMs, testCases } = req.body;
    if (name !== undefined) problem.name = name;
    if (statement !== undefined) problem.statement = statement;
    if (difficulty !== undefined) problem.difficulty = difficulty;
    if (tags !== undefined) problem.tags = tags;
    if (hints !== undefined) problem.hints = hints;
    if (timeLimitMs !== undefined) problem.timeLimitMs = timeLimitMs;
    await problem.save();

    if (Array.isArray(testCases) && testCases.length > 0) {
      await TestCase.deleteMany({ problem: problem._id });
      await TestCase.insertMany(
        testCases.map((tc) => ({ problem: problem._id, input: tc.input, output: tc.output, isSample: !!tc.isSample }))
      );
    }

    res.json({ problem });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/problems/:code (admin) - removes the problem, its test
// cases, and its reference from any contest it was attached to. Existing
// submissions against it are left alone as historical records.
async function deleteProblem(req, res, next) {
  try {
    const problem = await Problem.findOne({ code: req.params.code });
    if (!problem) return res.status(404).json({ message: 'Problem not found' });

    await TestCase.deleteMany({ problem: problem._id });
    await Contest.updateMany({ problems: problem._id }, { $pull: { problems: problem._id } });
    await problem.deleteOne();

    res.json({ message: 'Problem deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listProblems, getProblem, createProblem, nextProblemNumber, getProblemForEdit, updateProblem, deleteProblem };