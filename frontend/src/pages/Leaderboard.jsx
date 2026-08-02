import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    api.get('/leaderboard').then((res) => setLeaderboard(res.data.leaderboard));
  }, []);

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);
  const myEntry = leaderboard.find((e) => e.userId === user?.userId);

  return (
    <div className="page wide">
      <h2>Global Leaderboard</h2>
      <p className="page-sub">Every registered user, ranked by real contest rating</p>

      {leaderboard.length === 0 && <p className="empty-state">No rated contests have finished yet — ratings are still at their starting value.</p>}

      {top3.length > 0 && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {top3.map((e) => (
            <div className="stat-card" key={e.userId}>
              <div className="stat-value">#{e.rank}</div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>
                <Link to={`/profile/${e.userId}`}>{e.fullName}</Link>
              </div>
              <span className="badge badge-rank" style={{ marginTop: 8, display: 'inline-block' }}>
                {e.rankTitle}
              </span>
              <div className="stat-label" style={{ marginTop: 8 }}>
                {e.contestRating} rating · {e.problemsSolvedCount} solved
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="table-card" style={{ marginTop: 20 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>User</th>
              <th>Title</th>
              <th>Rating</th>
              <th>Solved</th>
            </tr>
          </thead>
          <tbody>
            {rest.map((e) => (
              <tr key={e.userId} style={e.userId === user?.userId ? { background: 'rgba(109,93,246,0.08)' } : undefined}>
                <td>#{e.rank}</td>
                <td>
                  <Link to={`/profile/${e.userId}`}>
                    {e.fullName} {e.userId === user?.userId && <span className="muted">(You)</span>}
                  </Link>
                </td>
                <td>
                  <span className="badge badge-outline">{e.rankTitle}</span>
                </td>
                <td>{e.contestRating}</td>
                <td className="muted">{e.problemsSolvedCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {myEntry && myEntry.rank > 3 && (
        <p className="hint" style={{ marginTop: 12 }}>
          Your current rank: #{myEntry.rank} · {myEntry.contestRating} rating
        </p>
      )}
    </div>
  );
}
