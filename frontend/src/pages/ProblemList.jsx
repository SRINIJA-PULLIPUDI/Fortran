import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import api from '../api/client';

const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard'];

export default function ProblemList() {
  const [problems, setProblems] = useState([]);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [difficulty, setDifficulty] = useState('All');

  useEffect(() => {
    api
      .get('/problems')
      .then((res) => setProblems(res.data.problems))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load problems'));
  }, []);

  const filtered = useMemo(() => {
    return problems.filter((p) => {
      const matchesQuery = !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.code.toLowerCase().includes(query.toLowerCase());
      const matchesDifficulty = difficulty === 'All' || p.difficulty === difficulty;
      return matchesQuery && matchesDifficulty;
    });
  }, [problems, query, difficulty]);

  const solvedCount = problems.filter((p) => p.solvedByMe).length;

  return (
    <div className="page wide">
      <h2>Problems</h2>
      <p className="page-sub">
        {problems.length} problems · {solvedCount} solved
      </p>
      {error && <p className="error">{error}</p>}

      <div className="table-card" style={{ padding: 18, marginBottom: 18 }}>
        <div className="btn-row" style={{ flexWrap: 'wrap' }}>
          <input
            placeholder="Search problems..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchParams(e.target.value ? { q: e.target.value } : {});
            }}
            style={{
              flex: 1,
              minWidth: 200,
              padding: '9px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          />
          {DIFFICULTIES.map((d) => (
            <button key={d} className={d === difficulty ? '' : 'ghost'} onClick={() => setDifficulty(d)} style={{ marginTop: 0 }}>
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>Problem</th>
              <th>Difficulty</th>
              <th>Acceptance</th>
              <th>Tags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p._id}>
                <td style={{ width: 24 }}>{p.solvedByMe && <Check size={16} color="var(--pass)" />}</td>
                <td>
                  <Link to={`/problems/${p.code}`}>{p.name}</Link>
                </td>
                <td>
                  <span className={`badge badge-${p.difficulty?.toLowerCase()}`}>{p.difficulty}</span>
                </td>
                <td className="muted">{p.acceptanceRate !== null ? `${p.acceptanceRate}%` : '—'}</td>
                <td className="muted">{(p.tags || []).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="empty-state">
            {problems.length === 0 ? 'No problems yet. An admin can add one from the sidebar.' : 'No problems match your search.'}
          </p>
        )}
      </div>
    </div>
  );
}
