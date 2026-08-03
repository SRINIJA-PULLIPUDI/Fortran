const mongoose = require('mongoose');

const problemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    statement: { type: String, required: true },
    code: { type: String, required: true, unique: true }, // short slug e.g. "TWO-SUM"
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Easy' },
    tags: [{ type: String }],
    hints: [{ type: String }],
    // Sequential display number ("Problem #1", "#2", ...). Only assigned once
    // a problem becomes publicly visible (isPractice: true) -- contest-only
    // problems stay null/unset until the contest is finalized, at which
    // point they're assigned the next number in the sequence. Sparse so
    // multiple contest-only problems can share "no number yet" without
    // violating the unique constraint.
    number: { type: Number, unique: true, sparse: true },
    timeLimitMs: { type: Number, default: 2000 },
    memoryLimitMb: { type: Number, default: 256 },
    isPractice: { type: Boolean, default: true }, // practice problems don't score
    contest: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Problem', problemSchema);