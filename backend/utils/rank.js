// Maps a contest rating to a title, the same way Codeforces does. Purely a
// label derived from data we already have (contestRating) -- not a separate
// fabricated field.
const THRESHOLDS = [
  { min: 2300, title: 'Grandmaster' },
  { min: 2100, title: 'Master' },
  { min: 1900, title: 'Candidate Master' },
  { min: 1600, title: 'Expert' },
  { min: 1400, title: 'Specialist' },
  { min: 1200, title: 'Pupil' },
  { min: -Infinity, title: 'Newbie' },
];

function rankTitle(rating) {
  return THRESHOLDS.find((t) => rating >= t.min).title;
}

// Longest current run of consecutive days (ending today or yesterday) with
// at least one submission, computed from the user's real activityLog.
function currentStreak(activityLog) {
  const dates = new Set(activityLog.filter((e) => e.count > 0).map((e) => e.date));
  if (dates.size === 0) return 0;

  const today = new Date();
  let cursor = new Date(today);
  // If there's no activity today, the streak may still be "alive" through
  // yesterday -- start counting from yesterday instead.
  if (!dates.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

module.exports = { rankTitle, currentStreak };
