// Formats a date as YYYY-MM-DD in UTC (keeps the streak map stable regardless of server timezone)
function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// Records that `user` made a submission today. Mutates user.activityLog (caller must save()).
function recordActivity(user, date = new Date()) {
  const key = todayKey(date);
  const entry = user.activityLog.find((e) => e.date === key);
  if (entry) {
    entry.count += 1;
  } else {
    user.activityLog.push({ date: key, count: 1 });
  }
}

module.exports = { todayKey, recordActivity };
