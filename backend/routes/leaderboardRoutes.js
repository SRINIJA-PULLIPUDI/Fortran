const express = require('express');
const { getGlobalLeaderboard } = require('../controllers/leaderboardController');

const router = express.Router();

router.get('/', getGlobalLeaderboard);

module.exports = router;
