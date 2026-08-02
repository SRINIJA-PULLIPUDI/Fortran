const mongoose = require('mongoose');

// Stores metadata + file path for a contest screen-recording chunk/session.
// Actual video bytes are saved to disk under /uploads/recordings and referenced here.
const recordingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    contest: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest', required: true },
    filePath: { type: String, required: true },
    fileSizeBytes: { type: Number },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

recordingSchema.index({ user: 1, contest: 1 });

module.exports = mongoose.model('Recording', recordingSchema);
