import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

const emptyTestCase = { input: '', output: '', isSample: false };

function blankNewProblem() {
  return {
    name: '',
    code: '',
    difficulty: 'Easy',
    tags: '',
    hints: '',
    statement: '',
    testCases: [{ ...emptyTestCase, isSample: true }, { ...emptyTestCase }],
  };
}

// Inline editor for a brand-new problem authored specifically for this
// contest. These are NOT existing catalog problems -- they're created with
// isPractice: false and stay off the public Problems list (tags/hints
// withheld too) until the contest is finalized, at which point they're
// promoted in with continued sequential numbering.
function NewProblemEditor({ draft, onChange, onRemove, index }) {
  function update(field, value) {
    onChange({ ...draft, [field]: value });
  }
  function updateTestCase(idx, field, value) {
    onChange({ ...draft, testCases: draft.testCases.map((tc, i) => (i === idx ? { ...tc, [field]: value } : tc)) });
  }
  function addTestCase() {
    onChange({ ...draft, testCases: [...draft.testCases, { ...emptyTestCase }] });
  }
  function removeTestCase(idx) {
    onChange({ ...draft, testCases: draft.testCases.filter((_, i) => i !== idx) });
  }

  return (
    <div className="table-card" style={{ padding: 16, marginBottom: 12 }}>
      <div className="btn-row" style={{ justifyContent: 'space-between', marginTop: 0 }}>
        <strong>New problem — Q{index + 1} in this contest</strong>
        <button type="button" className="link-btn danger" onClick={onRemove}>
          remove
        </button>
      </div>

      <label>Name</label>
      <input value={draft.name} onChange={(e) => update('name', e.target.value)} required />
      <label>Code (short slug, e.g. TWO-SUM)</label>
      <input value={draft.code} onChange={(e) => update('code', e.target.value)} required />
      <label>Difficulty</label>
      <select value={draft.difficulty} onChange={(e) => update('difficulty', e.target.value)}>
        <option>Easy</option>
        <option>Medium</option>
        <option>Hard</option>
      </select>
      <label>Tags (comma separated — hidden until the contest ends)</label>
      <input value={draft.tags} onChange={(e) => update('tags', e.target.value)} placeholder="math, strings" />
      <label>Hints (one per line, optional — hidden until the contest ends)</label>
      <textarea className="statement-input" value={draft.hints} onChange={(e) => update('hints', e.target.value)} rows={2} />
      <label>Statement</label>
      <textarea className="statement-input" value={draft.statement} onChange={(e) => update('statement', e.target.value)} rows={4} required />

      <label>Test Cases</label>
      {draft.testCases.map((tc, idx) => (
        <div key={idx} className="testcase-row">
          <textarea placeholder="input" value={tc.input} onChange={(e) => updateTestCase(idx, 'input', e.target.value)} rows={2} required />
          <textarea placeholder="expected output" value={tc.output} onChange={(e) => updateTestCase(idx, 'output', e.target.value)} rows={2} required />
          <label className="checkbox-row inline">
            <input type="checkbox" checked={tc.isSample} onChange={(e) => updateTestCase(idx, 'isSample', e.target.checked)} />
            sample
          </label>
          {draft.testCases.length > 1 && (
            <button type="button" className="link-btn danger" onClick={() => removeTestCase(idx)}>
              remove
            </button>
          )}
        </div>
      ))}
      <button type="button" className="secondary" onClick={addTestCase}>
        + Add test case
      </button>
    </div>
  );
}

export default function CreateContest() {
  const [form, setForm] = useState({ title: '', description: '', startTime: '', endTime: '', isRated: true });
  const [problems, setProblems] = useState([]);
  const [selectedProblems, setSelectedProblems] = useState([]);
  const [newProblems, setNewProblems] = useState([]);
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

  function addNewProblem() {
    setNewProblems((prev) => [...prev, blankNewProblem()]);
  }
  function updateNewProblem(idx, draft) {
    setNewProblems((prev) => prev.map((p, i) => (i === idx ? draft : p)));
  }
  function removeNewProblem(idx) {
    setNewProblems((prev) => prev.filter((_, i) => i !== idx));
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
        newProblems: newProblems.map((p) => ({
          name: p.name,
          code: p.code,
          difficulty: p.difficulty,
          tags: p.tags.split(',').map((t) => t.trim()).filter(Boolean),
          hints: p.hints.split('\n').map((h) => h.trim()).filter(Boolean),
          statement: p.statement,
          testCases: p.testCases,
        })),
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

        <label>Existing problems from the practice bank</label>
        <div className="checkbox-list">
          {problems.map((p) => (
            <label key={p._id} className="checkbox-row">
              <input type="checkbox" checked={selectedProblems.includes(p._id)} onChange={() => toggleProblem(p._id)} />
              {p.name} <span className={`badge badge-${p.difficulty?.toLowerCase()}`}>{p.difficulty}</span>
            </label>
          ))}
          {problems.length === 0 && <p className="muted">No existing problems yet.</p>}
        </div>

        <label style={{ marginTop: 18 }}>New problems written just for this contest</label>
        <p className="muted" style={{ marginTop: -6 }}>
          These stay off the public Problems list -- tags and hints hidden -- until the contest is finalized, then they're added
          to the practice bank continuing the problem numbering.
        </p>
        {newProblems.map((draft, idx) => (
          <NewProblemEditor
            key={idx}
            draft={draft}
            index={idx}
            onChange={(d) => updateNewProblem(idx, d)}
            onRemove={() => removeNewProblem(idx)}
          />
        ))}
        <button type="button" className="secondary" onClick={addNewProblem}>
          + New problem for this contest
        </button>

        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}
        <button type="submit">Create Contest</button>
      </form>
    </div>
  );
}
