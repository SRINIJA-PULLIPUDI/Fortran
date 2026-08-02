const express = require('express');
const rateLimit = require('express-rate-limit');
const { submitSolution, getSubmission, listMySubmissions, getMyStats, runCode } = require('../controllers/submissionController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Per-user submission rate limit: a light guard rail in front of the queue,
// not the primary defense against thundering herd (the queue is).
const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { message: 'Too many submissions - please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});
// Run is more frequent/exploratory than Submit, so it gets a looser limit.
const runLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: 'Too many runs - please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/run', protect, runLimiter, runCode);
router.get('/stats', protect, getMyStats);
router.post('/', protect, submitLimiter, submitSolution);
router.get('/:id', protect, getSubmission);
router.get('/', protect, listMySubmissions);

module.exports = router;
