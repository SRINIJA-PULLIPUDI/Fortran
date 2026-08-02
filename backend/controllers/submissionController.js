const Problem = require('../models/Problem');
const TestCase = require('../models/TestCase');
const Submission = require('../models/Submission');
const User = require('../models/User');
const { judgeSubmission, runAdHoc } = require('../services/codeExecutor');
const { checkPlagiarism } = require('../services/plagiarismChecker');
const { recordActivity } = require('../utils/streak');
const queue = require('../services/queueService');

// POST /api/submissions/run - "Run" button: executes code against
// user-supplied custom input, no grading, no persistence. Still goes through
// the same queue as real submissions since it still spends a sandbox container.
function runCode(req, res, next) {
  const { language, code, input } = req.body;
  if (!language || !code) {
    return res.status(400).json({ message: 'language and code are required' });
  }

  let responded = false;
  const timeoutGuard = setTimeout(() => {
    if (!responded) {
      responded = true;
      res.status(504).json({ message: 'Run is taking longer than expected (queue may be busy) - try again.' });
    }
  }, 20000);

  queue.enqueue(async () => {
    const result = await runAdHoc({ language, code, input: input || '' });
    clearTimeout(timeoutGuard);
    if (!responded) {
      responded = true;
      res.json({
        stdout: result.stdout,
        stderr: result.stderr,
        timedOut: result.timedOut,
        exitCode: result.exitCode,
      });
    }
  });
}

// POST /api/submissions - submit code for a problem (queued + evaluated async)
async function submitSolution(req, res, next) {
  try {
    const { problemCode, language, code, contestId } = req.body;
    if (!problemCode || !language || !code) {
      return res.status(400).json({ message: 'problemCode, language and code are required' });
    }

    const problem = await Problem.findOne({ code: problemCode });
    if (!problem) return res.status(404).json({ message: 'Problem not found' });

    const submission = await Submission.create({
      user: req.user._id,
      problem: problem._id,
      contest: contestId || null,
      language,
      code,
      verdict: 'Queued',
    });

    // Enqueue evaluation instead of running inline -- this is what protects the
    // server from the "thousands of users submit at once" thundering-herd case
    // called out in the HLD doc. Requests return immediately with a submission
    // id; the frontend polls GET /api/submissions/:id for the verdict.
    queue.enqueue(() => evaluateSubmission(submission._id));

    res.status(202).json({ submissionId: submission._id, verdict: 'Queued' });
  } catch (err) {
    next(err);
  }
}

async function evaluateSubmission(submissionId) {
  const submission = await Submission.findById(submissionId);
  if (!submission) return;

  submission.verdict = 'Running';
  await submission.save();

  const problem = await Problem.findById(submission.problem);
  const testCases = await TestCase.find({ problem: problem._id }).select('input output');

  const result = await judgeSubmission({
    language: submission.language,
    code: submission.code,
    testCases,
    timeLimitMs: problem.timeLimitMs,
  });

  submission.verdict = result.verdict;
  submission.passedTestCases = result.passedTestCases;
  submission.totalTestCases = result.totalTestCases;
  submission.executionTimeMs = result.executionTimeMs;
  submission.log = result.log || '';

  // Plagiarism check: only meaningful for contest submissions, compared
  // against other Accepted submissions to the same problem in the same contest.
  if (submission.contest) {
    const others = await Submission.find({
      contest: submission.contest,
      problem: problem._id,
      _id: { $ne: submission._id },
    }).select('code');
    const plag = checkPlagiarism(submission, others);
    submission.plagiarism = {
      checked: true,
      maxSimilarity: plag.maxSimilarity,
      flaggedAgainst: plag.flaggedAgainst,
    };
  }

  await submission.save();

  // Update user stats: totals, streak, solved list
  const user = await User.findById(submission.user);
  user.totalSubmissions += 1;
  if (result.verdict === 'Accepted') {
    user.acceptedSubmissions += 1;
    if (!user.problemsSolved.some((p) => String(p) === String(problem._id))) {
      user.problemsSolved.push(problem._id);
    }
  }
  recordActivity(user, submission.submittedAt);
  await user.save();
}

// GET /api/submissions/:id - poll for verdict
async function getSubmission(req, res, next) {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ message: 'Submission not found' });
    if (String(submission.user) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this submission' });
    }
    res.json({ submission });
  } catch (err) {
    next(err);
  }
}

// GET /api/submissions?limit=10&problem=CODE - recent submissions for the current user
async function listMySubmissions(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const filter = { user: req.user._id };

    if (req.query.problem) {
      const problem = await Problem.findOne({ code: req.query.problem });
      if (problem) filter.problem = problem._id;
    }

    const submissions = await Submission.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('problem', 'name code difficulty');
    res.json({ submissions });
  } catch (err) {
    next(err);
  }
}

// GET /api/submissions/stats - real aggregate counts by verdict for the current user
async function getMyStats(req, res, next) {
  try {
    const rows = await Submission.aggregate([
      { $match: { user: req.user._id, verdict: { $nin: ['Queued', 'Running'] } } },
      { $group: { _id: '$verdict', count: { $sum: 1 } } },
    ]);
    const byVerdict = Object.fromEntries(rows.map((r) => [r._id, r.count]));
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    res.json({
      total,
      accepted: byVerdict['Accepted'] || 0,
      wrongAnswer: byVerdict['Wrong Answer'] || 0,
      timeLimitExceeded: byVerdict['Time Limit Exceeded'] || 0,
      runtimeError: byVerdict['Runtime Error'] || 0,
      compilationError: byVerdict['Compilation Error'] || 0,
      internalError: byVerdict['Internal Error'] || 0,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { submitSolution, getSubmission, listMySubmissions, getMyStats, runCode };
