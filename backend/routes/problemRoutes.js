const express = require('express');
const { listProblems, getProblem, createProblem } = require('../controllers/problemController');
const { protect, maybeAuth, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', maybeAuth, listProblems);
router.get('/:code', getProblem);
router.post('/', protect, adminOnly, createProblem);

module.exports = router;
