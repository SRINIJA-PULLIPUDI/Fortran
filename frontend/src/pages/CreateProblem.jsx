import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

const emptyTestCase = { input: '', output: '', isSample: false };

export default function CreateProblem() {
  const [form, setForm] = useState({ name: '', code: '', difficulty: 'Easy', tags: '', hints: '', statement: '' });
  const [testCases, setTestCases] = useState([{ ...emptyTestCase, isSample: true }, { ...emptyTestCase }]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  function updateTestCase(idx, field, value) {
    setTestCases((tcs) => tcs.map((tc, i) => (i === idx ? { ...tc, [field]: value } : tc)));
  }

  function addTestCase() {
    setTestCases((tcs) => [...tcs, { ...emptyTestCase }]);
  }

  function removeTestCase(idx) {
    setTestCases((tcs) => tcs.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/problems', {
        name: form.name,
        code: form.code,
        difficulty: form.difficulty,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        hints: form.hints.split('\n').map((h) => h.trim()).filter(Boolean),
        statement: form.statement,
        isPractice: true,
        testCases,
      });
      setSuccess('Problem created.');
      setTimeout(() => navigate(`/problems/${res.data.problem.code}`), 800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create problem');
    }
  }

  return (
    <div className="page narrow">
      <div className="page-eyebrow">admin</div>
      <h2>New Problem</h2>
      <form onSubmit={handleSubmit} className="form">
        <label>Name</label>
        <input value={form.name} onChange={update('name')} required />
        <label>Code (short slug, e.g. TWO-SUM)</label>
        <input value={form.code} onChange={update('code')} required />
        <label>Difficulty</label>
        <select value={form.difficulty} onChange={update('difficulty')}>
          <option>Easy</option>
          <option>Medium</option>
          <option>Hard</option>
        </select>
        <label>Tags (comma separated)</label>
        <input value={form.tags} onChange={update('tags')} placeholder="math, strings" />
        <label>Hints (one per line, optional)</label>
        <textarea
          className="statement-input"
          value={form.hints}
          onChange={update('hints')}
          rows={3}
          placeholder={'Think about using a hash map.\nWatch out for negative numbers.'}
        />
        <label>Statement</label>
        <textarea className="statement-input" value={form.statement} onChange={update('statement')} rows={5} required />

        <label>Test Cases</label>
        {testCases.map((tc, idx) => (
          <div key={idx} className="testcase-row">
            <textarea placeholder="input" value={tc.input} onChange={(e) => updateTestCase(idx, 'input', e.target.value)} rows={2} required />
            <textarea placeholder="expected output" value={tc.output} onChange={(e) => updateTestCase(idx, 'output', e.target.value)} rows={2} required />
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
        {success && <p className="success">{success}</p>}
        <button type="submit">Create Problem</button>
      </form>
    </div>
  );
}
