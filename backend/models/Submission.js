const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    problem: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },
    contest: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest', default: null },
    language: { type: String, enum: ['python', 'cpp', 'java', 'javascript'], required: true },
    code: { type: String, required: true },
    verdict: {
      type: String,
      enum: [
        'Queued',
        'Running',
        'Accepted',
        'Wrong Answer',
        'Time Limit Exceeded',
        'Runtime Error',
        'Compilation Error',
        'Internal Error',
      ],
      default: 'Queued',
    },
    passedTestCases: { type: Number, default: 0 },
    totalTestCases: { type: Number, default: 0 },
    executionTimeMs: { type: Number, default: 0 },
    // Compiler errors, stack traces, etc. -- whatever the judge captured for
    // a failing verdict, so the frontend can actually show the user why.
    log: { type: String, default: '' },
    submittedAt: { type: Date, default: Date.now },

    // Plagiarism check results (populated after evaluation, for contest submissions)
    plagiarism: {
      checked: { type: Boolean, default: false },
      maxSimilarity: { type: Number, default: 0 }, // 0-100
      flaggedAgainst: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Submission' }],
    },
  },
  { timestamps: true }
);

submissionSchema.index({ user: 1, problem: 1 });
submissionSchema.index({ contest: 1, verdict: 1 });

module.exports = mongoose.model('Submission', submissionSchema);
