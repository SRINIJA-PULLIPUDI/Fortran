import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    if (!user) return;
    api.get(`/profile/${user.userId}`).then((res) => setProfile(res.data.profile));
    api.get('/submissions?limit=5').then((res) => setRecent(res.data.submissions));
  }, [user]);

  if (!profile) return <div className="page">Loading...</div>;

  return (
    <div className="page wide">
      <div className="page-eyebrow">welcome back</div>
      <h2>{profile.fullName.split(' ')[0]}'s Dashboard</h2>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{profile.problemsSolvedCount}</div>
          <div className="stat-label">Problems Solved</div>
        </div>
        <div className="stat-card">
          <div className="stat-value pass">{profile.acceptanceRate}%</div>
          <div className="stat-label">Acceptance Rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{profile.contestRating}</div>
          <div className="stat-label">{profile.rankTitle}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value warn">{profile.currentStreak}</div>
          <div className="stat-label">Day Streak</div>
        </div>
      </div>

      <h4 className="section-label">Recent Submissions</h4>
      {recent.length === 0 && <p className="empty-state">No submissions yet — solve your first problem to see it here.</p>}
      <div className="table-card">
        <table className="table">
          <tbody>
            {recent.map((s) => (
              <tr key={s._id}>
                <td>
                  <Link to={`/problems/${s.problem?.code}`}>{s.problem?.name}</Link>
                </td>
                <td>
                  <span className={`badge badge-${s.verdict === 'Accepted' ? 'easy' : s.verdict === 'Wrong Answer' || s.verdict === 'Runtime Error' ? 'hard' : 'medium'}`}>
                    {s.verdict}
                  </span>
                </td>
                <td className="muted">{s.language}</td>
                <td className="muted">{new Date(s.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="section-label">Quick Links</h4>
      <div className="btn-row">
        <Link to="/problems" className="btn btn-outline">
          Browse Problems
        </Link>
        <Link to="/contests" className="btn btn-outline">
          View Contests
        </Link>
        <Link to="/leaderboard" className="btn btn-outline">
          Global Leaderboard
        </Link>
      </div>
    </div>
  );
}
