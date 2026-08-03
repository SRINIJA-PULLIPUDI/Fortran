import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';
import CodeEditor from '../components/CodeEditor';

const STARTER = {
  python: '# Read input with input(), print your answer\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // your code here\n    return 0;\n}\n',
  java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // your code here\n    }\n}\n',
  javascript: '// Read stdin, print with console.log\n',
};

const TRACE_STEPS = {
  Queued: 'Queued for judging...',
  Running: 'Building sandbox container and running test cases...',
};

function HintsPanel({ hints }) {
  const [revealed, setRevealed] = useState([]);

  function reveal(i) {
    setRevealed((r) => (r.includes(i) ? r : [...r, i]));
  }

  return (
    <div style={{ marginTop: 14, marginBottom: 14 }}>
      <h4 className="section-label">Hints</h4>
      {hints.map((h, i) =>
        revealed.includes(i) ? (
          <p key={i} className="hint" style={{ marginBottom: 6 }}>
            {h}
          </p>
        ) : (
          <button key={i} type="button" className="ghost" style={{ marginRight: 8, marginTop: 0 }} onClick={() => reveal(i)}>
            Show hint {i + 1}
          </button>
        )
      )}
    </div>
  );
}

export default function ProblemDetail() {
  const { code, id: contestId } = useParams();
  const [problem, setProblem] = useState(null);
  const [samples, setSamples] = useState([]);
  const [language, setLanguage] = useState('python');
  const [source, setSource] = useState(STARTER.python);
  const [tab, setTab] = useState('problem');
  const [mySubmissions, setMySubmissions] = useState([]);

  const [verdict, setVerdict] = useState(null);
  const [trace, setTrace] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  const [customInput, setCustomInput] = useState('');
  const [runOutput, setRunOutput] = useState(null);
  const [running, setRunning] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    setProblem(null);
    setLoadError('');
    api
      .get(`/problems/${code}`)
      .then((res) => {
        setProblem(res.data.problem);
        setSamples(res.data.samples);
        if (res.data.samples[0]) setCustomInput(res.data.samples[0].input);
      })
      .catch((err) => {
        setLoadError(err.response?.data?.message || 'Problem not found');
      });
    return () => clearInterval(pollRef.current);
  }, [code]);

  useEffect(() => {
    if (tab === 'submissions') {
      api.get(`/submissions?problem=${code}&limit=20`).then((res) => setMySubmissions(res.data.submissions));
    }
  }, [tab, code]);

  function handleLanguageChange(e) {
    const lang = e.target.value;
    setLanguage(lang);
    setSource(STARTER[lang]);
  }

  function pushTrace(line) {
    setTrace((t) => (t[t.length - 1] === line ? t : [...t, line]));
  }

  async function handleRun() {
    setRunOutput(null);
    setRunning(true);
    try {
      const res = await api.post('/submissions/run', { language, code: source, input: customInput });
      setRunOutput(res.data);
    } catch (err) {
      setRunOutput({ stderr: err.response?.data?.message || 'Run failed', stdout: '' });
    } finally {
      setRunning(false);
    }
  }

  async function handleSubmit() {
    setError('');
    setVerdict(null);
    setTrace(['> submitting solution...']);
    setSubmitting(true);
    try {
      const res = await api.post('/submissions', { problemCode: code, language, code: source, contestId: contestId || undefined });
      const submissionId = res.data.submissionId;
      pushTrace('> queued (id ' + submissionId.slice(-6) + ')');

      pollRef.current = setInterval(async () => {
        const poll = await api.get(`/submissions/${submissionId}`);
        const sub = poll.data.submission;
        if (TRACE_STEPS[sub.verdict]) pushTrace('> ' + TRACE_STEPS[sub.verdict]);
        setVerdict(sub);
        if (!['Queued', 'Running'].includes(sub.verdict)) {
          clearInterval(pollRef.current);
          pushTrace(`> ${sub.verdict} (${sub.passedTestCases}/${sub.totalTestCases} test cases, ${sub.executionTimeMs}ms)`);
          setSubmitting(false);
        }
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed');
      setSubmitting(false);
    }
  }

  if (loadError) return <div className="page error">{loadError}</div>;
  if (!problem) return <div className="page">Loading...</div>;

  const isFailure = verdict && !['Queued', 'Running', 'Accepted'].includes(verdict.verdict);

  return (
    <div className="page wide">
      <div className="tab-strip">
        <button className={`tab-item ${tab === 'problem' ? 'active' : ''}`} onClick={() => setTab('problem')}>
          Problem
        </button>
        <button className={`tab-item ${tab === 'submissions' ? 'active' : ''}`} onClick={() => setTab('submissions')}>
          My Submissions
        </button>
      </div>

      {tab === 'submissions' ? (
        <div className="table-card">
          <table className="table">
            <thead>
              <tr>
                <th>Verdict</th>
                <th>Language</th>
                <th>Tests</th>
                <th>Runtime</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {mySubmissions.map((s) => (
                <tr key={s._id}>
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
          {mySubmissions.length === 0 && <p className="empty-state">No submissions to this problem yet.</p>}
        </div>
      ) : (
        <div className="problem-detail-grid">
          <div>
            {contestId && (
              <p className="hint" style={{ marginBottom: 10 }}>
                Solving as part of a live contest — topic tags and hints stay hidden until the contest ends.
              </p>
            )}
            <div className="problem-header">
              <h2 style={{ marginBottom: 0 }}>{problem.name}</h2>
              <span className={`badge badge-${problem.difficulty?.toLowerCase()}`}>{problem.difficulty}</span>
            </div>
            {problem.tags?.length > 0 && (
              <div className="btn-row" style={{ marginTop: 8 }}>
                {problem.tags.map((t) => (
                  <span key={t} className="badge badge-outline">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <p className="statement">{problem.statement}</p>

            {problem.hints?.length > 0 && <HintsPanel hints={problem.hints} />}

            <h4 className="section-label">Sample I/O</h4>
            {samples.map((s, i) => (
              <div key={i} className="sample">
                <span className="sample-label">input</span>
                <pre>{s.input}</pre>
                <span className="sample-label" style={{ marginTop: 8 }}>
                  output
                </span>
                <pre>{s.output}</pre>
              </div>
            ))}
          </div>

          <div>
            <div className="editor-toolbar">
              <select value={language} onChange={handleLanguageChange}>
                <option value="python">Python</option>
                <option value="cpp">C++</option>
                <option value="java">Java</option>
                <option value="javascript">JavaScript</option>
              </select>
              <span className="editor-hint">Tab indents · Shift+Tab outdents</span>
              <div className="editor-actions">
                <button className="ghost" onClick={handleRun} disabled={running}>
                  {running ? 'Running...' : 'Run'}
                </button>
                <button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Judging...' : 'Submit'}
                </button>
              </div>
            </div>

            <CodeEditor value={source} onChange={setSource} rows={14} />

            <div className="io-panels">
              <div className="io-panel">
                <div className="io-panel-label">custom input</div>
                <textarea value={customInput} onChange={(e) => setCustomInput(e.target.value)} rows={4} />
              </div>
              <div className="io-panel">
                <div className="io-panel-label">output</div>
                <pre>
                  {runOutput
                    ? runOutput.stderr
                      ? runOutput.stderr
                      : runOutput.stdout || '(no output)'
                    : 'Press "Run" to see output'}
                </pre>
              </div>
            </div>

            {error && <p className="error">{error}</p>}

            {trace.length > 0 && (
              <div className="build-trace">
                <div className="build-trace-header">build output</div>
                {trace.map((line, i) => (
                  <div key={i} className="build-trace-line">
                    {line}
                  </div>
                ))}
              </div>
            )}

            {verdict && (
              <div className={`verdict verdict-${verdict.verdict?.replace(/\s+/g, '-').toLowerCase()}`}>
                <div className="verdict-title">
                  <strong>{verdict.verdict}</strong>
                  {verdict.totalTestCases > 0 && (
                    <span>
                      {' '}
                      — {verdict.passedTestCases}/{verdict.totalTestCases} test cases · {verdict.executionTimeMs}ms
                    </span>
                  )}
                </div>
                {isFailure && verdict.log && (
                  <>
                    <div className="verdict-log-label">Why it failed:</div>
                    <pre className="verdict-log">{verdict.log}</pre>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
