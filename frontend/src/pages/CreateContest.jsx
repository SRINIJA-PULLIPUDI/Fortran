import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function CreateContest() {
  const [form, setForm] = useState({ title: '', description: '', startTime: '', endTime: '', isRated: true });
  const [problems, setProblems] = useState([]);
  const [selectedProblems, setSelectedProblems] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/problems').then((res) => setProblems(res.data.problems));
  }, []);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  function toggleProblem(id) {
    setSelectedProblems((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/contests', {
        title: form.title,
        description: form.description,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        problems: selectedProblems,
        isRated: form.isRated,
      });
      setSuccess('Contest created.');
      setTimeout(() => navigate(`/contests/${res.data.contest._id}`), 800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create contest');
    }
  }

  return (
    <div className="page narrow">
      <div className="page-eyebrow">admin</div>
      <h2>New Contest</h2>
      <form onSubmit={handleSubmit} className="form">
        <label>Title</label>
        <input value={form.title} onChange={update('title')} required />
        <label>Description</label>
        <input value={form.description} onChange={update('description')} />
        <label>Start Time</label>
        <input type="datetime-local" value={form.startTime} onChange={update('startTime')} required />
        <label>End Time</label>
        <input type="datetime-local" value={form.endTime} onChange={update('endTime')} required />

        <label className="checkbox-row">
          <input type="checkbox" checked={form.isRated} onChange={(e) => setForm({ ...form, isRated: e.target.checked })} />
          Rated contest (affects participants' contest rating when finalized)
        </label>

        <label>Problems</label>
        <div className="checkbox-list">
          {problems.map((p) => (
            <label key={p._id} className="checkbox-row">
              <input type="checkbox" checked={selectedProblems.includes(p._id)} onChange={() => toggleProblem(p._id)} />
              {p.name} <span className={`badge badge-${p.difficulty?.toLowerCase()}`}>{p.difficulty}</span>
            </label>
          ))}
          {problems.length === 0 && <p className="muted">No problems yet — create one first.</p>}
        </div>

        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}
        <button type="submit">Create Contest</button>
      </form>
    </div>
  );
}
