const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema(
  {
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },
    input: { type: String, required: true },
    output: { type: String, required: true },
    isSample: { type: Boolean, default: false }, // sample cases can be shown to users
  },
  { timestamps: true }
);

module.exports = mongoose.model('TestCase', testCaseSchema);
