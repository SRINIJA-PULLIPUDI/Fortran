import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function ContestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [contest, setContest] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [joined, setJoined] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeMsg, setFinalizeMsg] = useState('');

  useEffect(() => {
    api.get('/contests').then((res) => {
      const c = res.data.contests.find((x) => x._id === id);
      setContest(c);
      if (c && user) setJoined(c.participants?.some((p) => String(p) === String(user.id)));
    });
    loadLeaderboard();
  }, [id, user]);

  function loadLeaderboard() {
    api.get(`/contests/${id}/leaderboard`).then((res) => setLeaderboard(res.data.leaderboard));
  }

  async function handleRegister() {
    await api.post(`/contests/${id}/register`);
    setJoined(true);
  }

  async function handleFinalize() {
    setFinalizing(true);
    setFinalizeMsg('');
    try {
      const res = await api.post(`/contests/${id}/finalize`);
      setFinalizeMsg(`Finalized — ${res.data.updatedUsers} users' ratings updated.`);
      loadLeaderboard();
    } catch (err) {
      setFinalizeMsg(err.response?.data?.message || 'Failed to finalize');
    } finally {
      setFinalizing(false);
    }
  }

  if (!contest) return <div className="page">Loading...</div>;

  return (
    <div className="page wide">
      <div className="btn-row" style={{ marginBottom: 8 }}>
        <span className={`badge status-${contest.status?.toLowerCase()}`}>{contest.status}</span>
        <span className={`badge ${contest.isRated ? 'badge-rank' : 'badge-outline'}`}>{contest.isRated ? 'Rated' : 'Unrated'}</span>
      </div>
      <h2>{contest.title}</h2>
      <p className="muted">{contest.description}</p>
      <p className="muted">
        {new Date(contest.startTime).toLocaleString()} — {new Date(contest.endTime).toLocaleString()} · {contest.participants?.length || 0} registered
      </p>

      <div className="btn-row">
        {user && !joined && <button onClick={handleRegister}>Register for Contest</button>}
        {user?.role === 'admin' && contest.status === 'Ended' && (
          <button className="ghost" onClick={handleFinalize} disabled={finalizing}>
            {finalizing ? 'Finalizing...' : 'Finalize Contest & Update Ratings'}
          </button>
        )}
      </div>
      {finalizeMsg && <p className="hint">{finalizeMsg}</p>}

      <h4 className="section-label">Problems</h4>
      <div className="table-card">
        <ul className="solved-list">
          {(contest.problems || []).map((p, idx) => (
            <li key={p._id || p}>
              <Link to={`/contests/${id}/problems/${p.code || p}?q=${idx + 1}`}>
                Q{idx + 1}. {p.name || p}
              </Link>
            </li>
          ))}
        </ul>
        {(!contest.problems || contest.problems.length === 0) && <p className="empty-state">No problems attached to this contest.</p>}
      </div>

      <h4 className="section-label">Leaderboard</h4>
      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>User</th>
              <th>Rating</th>
              <th>Problems Solved</th>
              <th>Last Solve Time</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry) => (
              <tr key={entry.user._id}>
                <td>{entry.rank}</td>
                <td>
                  <Link to={`/profile/${entry.user.userId}`}>{entry.user.fullName}</Link>
                </td>
                <td>{entry.user.contestRating}</td>
                <td>{entry.problemsSolved}</td>
                <td>{new Date(entry.lastSolvedAt).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {leaderboard.length === 0 && <p className="empty-state">No accepted submissions yet.</p>}
      </div>
    </div>
  );
}
