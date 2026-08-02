import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api/client';
import StreakHeatmap from '../components/StreakHeatmap';
import Avatar from '../components/Avatar';

export default function Profile() {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    api
      .get(`/profile/${userId}`)
      .then((res) => setProfile(res.data.profile))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load profile'));
  }, [userId]);

  useEffect(() => {
    if (tab === 'submissions' && submissions.length === 0) {
      api.get('/submissions?limit=30').then((res) => setSubmissions(res.data.submissions)).catch(() => {});
    }
  }, [tab]);

  if (error) return <div className="page error">{error}</div>;
  if (!profile) return <div className="page">Loading...</div>;

  const ratingData = profile.ratingHistory.map((r, i) => ({
    name: `#${i + 1}`,
    rating: r.rating,
    date: new Date(r.date).toLocaleDateString(),
  }));

  return (
    <div className="page wide">
      <div className="profile-hero">
        <Avatar fullName={profile.fullName} userId={profile.userId} size="lg" />
        <div className="profile-hero-info">
          <div className="profile-hero-name">{profile.fullName}</div>
          <span className="badge badge-rank">{profile.rankTitle}</span>
          <div className="profile-hero-meta">@{profile.userId}</div>
        </div>
        <div className="profile-hero-stats">
          <div className="profile-hero-stat">
            <div className="stat-value">{profile.contestRating}</div>
            <div className="stat-label">Rating</div>
          </div>
          <div className="profile-hero-stat">
            <div className="stat-value">{profile.problemsSolvedCount}</div>
            <div className="stat-label">Solved</div>
          </div>
          <div className="profile-hero-stat">
            <div className="stat-value warn">{profile.currentStreak}</div>
            <div className="stat-label">Streak</div>
          </div>
          <div className="profile-hero-stat">
            <div className="stat-value pass">{profile.acceptanceRate}%</div>
            <div className="stat-label">Acceptance</div>
          </div>
        </div>
      </div>

      <div className="tab-strip">
        <button className={`tab-item ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button className={`tab-item ${tab === 'submissions' ? 'active' : ''}`} onClick={() => setTab('submissions')}>
          Submissions
        </button>
      </div>

      {tab === 'overview' ? (
        <>
          <h4 className="section-label">Submission Activity</h4>
          <div className="table-card" style={{ padding: 18 }}>
            <StreakHeatmap activityLog={profile.activityLog} />
            <div className="heat-legend">
              <span>Less</span>
              <span className="heat-cell heat-0" />
              <span className="heat-cell heat-1" />
              <span className="heat-cell heat-2" />
              <span className="heat-cell heat-3" />
              <span>More</span>
            </div>
          </div>

          <h4 className="section-label">Contest Rating Graph</h4>
          {ratingData.length > 0 ? (
            <div className="table-card" style={{ padding: 18 }}>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={ratingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#23242e" />
                  <XAxis dataKey="name" stroke="#5b5f6d" />
                  <YAxis domain={['dataMin - 100', 'dataMax + 100']} stroke="#5b5f6d" />
                  <Tooltip
                    formatter={(value, name, props) => [value, `Rating (${props.payload.date})`]}
                    contentStyle={{ background: '#16171f', border: '1px solid #23242e', borderRadius: 8 }}
                  />
                  <Line type="monotone" dataKey="rating" stroke="#6d5df6" strokeWidth={2} dot={{ r: 4, fill: '#4fa8f7' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="empty-state">No rated contests completed yet — the graph fills in after your first one.</p>
          )}

          <h4 className="section-label">Problems Solved</h4>
          <div className="table-card">
            <ul className="solved-list">
              {profile.problemsSolved.map((p) => (
                <li key={p._id}>
                  {p.name} <span className={`badge badge-${p.difficulty?.toLowerCase()}`}>{p.difficulty}</span>
                </li>
              ))}
            </ul>
            {profile.problemsSolved.length === 0 && <p className="empty-state">No problems solved yet.</p>}
          </div>
        </>
      ) : (
        <div className="table-card">
          <table className="table">
            <thead>
              <tr>
                <th>Problem</th>
                <th>Verdict</th>
                <th>Language</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s._id}>
                  <td>{s.problem?.name}</td>
                  <td>
                    <span className={`badge badge-${s.verdict === 'Accepted' ? 'easy' : 'hard'}`}>{s.verdict}</span>
                  </td>
                  <td className="muted">{s.language}</td>
                  <td className="muted">{new Date(s.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {submissions.length === 0 && <p className="empty-state">No submissions to show (only visible for your own account).</p>}
        </div>
      )}
    </div>
  );
}
