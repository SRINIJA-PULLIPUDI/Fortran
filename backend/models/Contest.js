const mongoose = require('mongoose');

const contestSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    problems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Problem' }],
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isRated: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

contestSchema.virtual('status').get(function () {
  const now = new Date();
  if (now < this.startTime) return 'Upcoming';
  if (now > this.endTime) return 'Ended';
  return 'Live';
});

contestSchema.set('toJSON', { virtuals: true });
contestSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Contest', contestSchema);
