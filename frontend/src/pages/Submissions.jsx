import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

const VERDICT_FILTERS = ['All', 'Accepted', 'Wrong Answer', 'Time Limit Exceeded', 'Runtime Error', 'Compilation Error'];

export default function Submissions() {
  const [stats, setStats] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    api.get('/submissions/stats').then((res) => setStats(res.data));
    api.get('/submissions?limit=50').then((res) => setSubmissions(res.data.submissions));
  }, []);

  const filtered = filter === 'All' ? submissions : submissions.filter((s) => s.verdict === filter);

  return (
    <div className="page wide">
      <h2>Submissions</h2>
      {stats && (
        <p className="page-sub">
          {stats.total} submissions · {stats.accepted} accepted · {stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0}% acceptance rate
        </p>
      )}

      {stats && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-card">
            <div className="stat-value pass">{stats.accepted}</div>
            <div className="stat-label">Accepted</div>
          </div>
          <div className="stat-card">
            <div className="stat-value fail">{stats.wrongAnswer}</div>
            <div className="stat-label">Wrong Answer</div>
          </div>
          <div className="stat-card">
            <div className="stat-value warn">{stats.timeLimitExceeded}</div>
            <div className="stat-label">TLE</div>
          </div>
          <div className="stat-card">
            <div className="stat-value fail">{stats.runtimeError + stats.compilationError + stats.internalError}</div>
            <div className="stat-label">Errors</div>
          </div>
        </div>
      )}

      <div className="btn-row" style={{ flexWrap: 'wrap', margin: '18px 0' }}>
        {VERDICT_FILTERS.map((v) => (
          <button key={v} className={v === filter ? '' : 'ghost'} style={{ marginTop: 0 }} onClick={() => setFilter(v)}>
            {v}
          </button>
        ))}
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Problem</th>
              <th>Verdict</th>
              <th>Language</th>
              <th>Tests</th>
              <th>Runtime</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s._id}>
                <td>
                  <Link to={`/problems/${s.problem?.code}`}>{s.problem?.name}</Link>
                </td>
                <td>
                  <span className={`badge badge-${s.verdict === 'Accepted' ? 'easy' : 'hard'}`}>{s.verdict}</span>
                </td>
                <td className="muted">{s.language}</td>
                <td className="muted">
                  {s.passedTestCases}/{s.totalTestCases}
                </td>
                <td className="muted">{s.executionTimeMs}ms</td>
                <td className="muted">{new Date(s.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="empty-state">No submissions match this filter.</p>}
      </div>
    </div>
  );
}
