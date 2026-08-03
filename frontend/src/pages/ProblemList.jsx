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
  const [tagFilter, setTagFilter] = useState('');
  const [minAcceptance, setMinAcceptance] = useState('');
  const [numberFilter, setNumberFilter] = useState('');

  useEffect(() => {
    api
      .get('/problems')
      .then((res) => setProblems(res.data.problems))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load problems'));
  }, []);

  const allTags = useMemo(() => {
    const set = new Set();
    problems.forEach((p) => (p.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [problems]);

  const filtered = useMemo(() => {
    return problems.filter((p) => {
      const matchesQuery = !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.code.toLowerCase().includes(query.toLowerCase());
      const matchesDifficulty = difficulty === 'All' || p.difficulty === difficulty;
      const matchesTag = !tagFilter || (p.tags || []).includes(tagFilter);
      const matchesAcceptance = !minAcceptance || (p.acceptanceRate !== null && p.acceptanceRate >= Number(minAcceptance));
      const matchesNumber = !numberFilter || String(p.number) === numberFilter.trim();
      return matchesQuery && matchesDifficulty && matchesTag && matchesAcceptance && matchesNumber;
    });
  }, [problems, query, difficulty, tagFilter, minAcceptance, numberFilter]);

  const solvedCount = problems.filter((p) => p.solvedByMe).length;

  function clearFilters() {
    setQuery('');
    setSearchParams({});
    setDifficulty('All');
    setTagFilter('');
    setMinAcceptance('');
    setNumberFilter('');
  }

  const inputStyle = {
    padding: '9px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
  };

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
            placeholder="Search by name or code..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchParams(e.target.value ? { q: e.target.value } : {});
            }}
            style={{ ...inputStyle, flex: 2, minWidth: 200 }}
          />
          {DIFFICULTIES.map((d) => (
            <button key={d} className={d === difficulty ? '' : 'ghost'} onClick={() => setDifficulty(d)} style={{ marginTop: 0 }}>
              {d}
            </button>
          ))}
        </div>

        <div className="btn-row" style={{ flexWrap: 'wrap', marginTop: 10 }}>
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
            <option value="">All topics</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            max="100"
            placeholder="Min acceptance %"
            value={minAcceptance}
            onChange={(e) => setMinAcceptance(e.target.value)}
            style={{ ...inputStyle, width: 160 }}
          />
          <input
            type="number"
            min="1"
            placeholder="Problem #"
            value={numberFilter}
            onChange={(e) => setNumberFilter(e.target.value)}
            style={{ ...inputStyle, width: 120 }}
          />
          {(tagFilter || minAcceptance || numberFilter || query || difficulty !== 'All') && (
            <button className="ghost" style={{ marginTop: 0 }} onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>#</th>
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
                <td className="muted">{p.number}</td>
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
            {problems.length === 0 ? 'No problems yet. An admin can add one from the sidebar.' : 'No problems match your filters.'}
          </p>
        )}
      </div>
    </div>
  );
}
