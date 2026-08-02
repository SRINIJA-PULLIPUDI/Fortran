const express = require('express');
const {
  listContests,
  createContest,
  registerForContest,
  getLeaderboard,
  finalizeContest,
} = require('../controllers/contestController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', listContests);
router.post('/', protect, adminOnly, createContest);
router.post('/:id/register', protect, registerForContest);
router.get('/:id/leaderboard', getLeaderboard);
router.post('/:id/finalize', protect, adminOnly, finalizeContest);

module.exports = router;
