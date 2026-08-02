const mongoose = require('mongoose');

const problemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    statement: { type: String, required: true },
    code: { type: String, required: true, unique: true }, // short slug e.g. "TWO-SUM"
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Easy' },
    tags: [{ type: String }],
    timeLimitMs: { type: Number, default: 2000 },
    memoryLimitMb: { type: Number, default: 256 },
    isPractice: { type: Boolean, default: true }, // practice problems don't score
    contest: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Problem', problemSchema);
