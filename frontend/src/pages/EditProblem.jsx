import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function EditProblem() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [testCases, setTestCases] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get(`/problems/${code}/edit`)
      .then((res) => {
        const p = res.data.problem;
        setForm({
          name: p.name,
          difficulty: p.difficulty,
          tags: (p.tags || []).join(', '),
          hints: (p.hints || []).join('\n'),
          statement: p.statement,
        });
        setTestCases(res.data.testCases.map((tc) => ({ input: tc.input, output: tc.output, isSample: tc.isSample })));
      })
      .catch((err) => setLoadError(err.response?.data?.message || 'Failed to load problem'));
  }, [code]);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }
  function updateTestCase(idx, field, value) {
    setTestCases((prev) => prev.map((tc, i) => (i === idx ? { ...tc, [field]: value } : tc)));
  }
  function addTestCase() {
    setTestCases((prev) => [...prev, { input: '', output: '', isSample: false }]);
  }
  function removeTestCase(idx) {
    setTestCases((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.put(`/problems/${code}`, {
        name: form.name,
        difficulty: form.difficulty,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        hints: form.hints.split('\n').map((h) => h.trim()).filter(Boolean),
        statement: form.statement,
        testCases,
      });
      navigate(`/problems/${code}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save changes');
      setSaving(false);
    }
  }

  if (loadError) return <div className="page error">{loadError}</div>;
  if (!form) return <div className="page">Loading...</div>;

  return (
    <div className="page narrow">
      <div className="page-eyebrow">admin</div>
      <h2>Edit Problem</h2>
      <p className="muted">
        Editing <code>{code}</code>. The code/slug itself can't be changed here (it's part of the URL and any links to it).
      </p>
      <form onSubmit={handleSubmit} className="form">
        <label>Name</label>
        <input value={form.name} onChange={update('name')} required />
        <label>Difficulty</label>
        <select value={form.difficulty} onChange={update('difficulty')}>
          <option>Easy</option>
          <option>Medium</option>
          <option>Hard</option>
        </select>
        <label>Tags (comma separated)</label>
        <input value={form.tags} onChange={update('tags')} placeholder="math, strings" />
        <label>Hints (one per line, optional)</label>
        <textarea value={form.hints} onChange={update('hints')} rows={3} />
        <label>Statement</label>
        <textarea value={form.statement} onChange={update('statement')} rows={6} required />

        <label>Test Cases</label>
        {testCases.map((tc, idx) => (
          <div key={idx} className="testcase-row">
            <textarea placeholder="input" value={tc.input} onChange={(e) => updateTestCase(idx, 'input', e.target.value)} rows={2} required />
            <textarea
              placeholder="expected output"
              value={tc.output}
              onChange={(e) => updateTestCase(idx, 'output', e.target.value)}
              rows={2}
              required
            />
            <label className="checkbox-row inline">
              <input type="checkbox" checked={tc.isSample} onChange={(e) => updateTestCase(idx, 'isSample', e.target.checked)} />
              sample
            </label>
            {testCases.length > 1 && (
              <button type="button" className="link-btn danger" onClick={() => removeTestCase(idx)}>
                remove
              </button>
            )}
          </div>
        ))}
        <button type="button" className="secondary" onClick={addTestCase}>
          + Add test case
        </button>

        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
