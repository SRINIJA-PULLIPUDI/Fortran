const express = require('express');
const {
  listProblems,
  getProblem,
  createProblem,
  getProblemForEdit,
  updateProblem,
  deleteProblem,
} = require('../controllers/problemController');
const { protect, maybeAuth, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', maybeAuth, listProblems);
router.get('/:code/edit', protect, adminOnly, getProblemForEdit);
router.get('/:code', getProblem);
router.post('/', protect, adminOnly, createProblem);
router.put('/:code', protect, adminOnly, updateProblem);
router.delete('/:code', protect, adminOnly, deleteProblem);

module.exports = router;