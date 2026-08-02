const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    userId: { type: String, required: true, unique: true, trim: true }, // login handle
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    dob: { type: Date },

    // Profile / stats (denormalized for fast profile reads)
    contestRating: { type: Number, default: 1200 },
    ratingHistory: [
      {
        contest: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest' },
        rating: Number,
        date: { type: Date, default: Date.now },
      },
    ],
    problemsSolved: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Problem' }],
    totalSubmissions: { type: Number, default: 0 },
    acceptedSubmissions: { type: Number, default: 0 },

    // Daily streak map: array of { date: 'YYYY-MM-DD', count: Number }
    activityLog: [
      {
        date: { type: String, required: true }, // YYYY-MM-DD
        count: { type: Number, default: 0 },
      },
    ],

    role: { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.acceptanceRate = function () {
  if (this.totalSubmissions === 0) return 0;
  return Number(((this.acceptedSubmissions / this.totalSubmissions) * 100).toFixed(2));
};

module.exports = mongoose.model('User', userSchema);
