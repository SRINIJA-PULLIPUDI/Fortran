// Renders a GitHub/LeetCode-style activity calendar: green if there was a
// submission that day, grey otherwise. activityLog: [{date: 'YYYY-MM-DD', count}]
export default function StreakHeatmap({ activityLog }) {
  const countByDate = new Map(activityLog.map((e) => [e.date, e.count]));

  const today = new Date();
  const days = [];
  // Build the last 182 days (~6 months), grouped into weeks (columns)
  for (let i = 181; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, count: countByDate.get(key) || 0, label: d.toDateString() });
  }

  // Pad to start on a Sunday so weeks line up into a grid
  const firstDow = new Date(days[0].date).getUTCDay();
  const padded = Array(firstDow).fill(null).concat(days);

  const weeks = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  function levelClass(count) {
    if (!count) return 'heat-0';
    if (count === 1) return 'heat-1';
    if (count <= 3) return 'heat-2';
    return 'heat-3';
  }

  return (
    <div className="heatmap">
      {weeks.map((week, wi) => (
        <div className="heatmap-col" key={wi}>
          {week.map((day, di) =>
            day ? (
              <div key={di} className={`heat-cell ${levelClass(day.count)}`} title={`${day.label}: ${day.count} submission(s)`} />
            ) : (
              <div key={di} className="heat-cell heat-empty" />
            )
          )}
        </div>
      ))}
    </div>
  );
}
