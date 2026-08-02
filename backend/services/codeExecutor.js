/**
 * Executes untrusted user code via the free, public Piston code-execution
 * API (https://github.com/engineer-man/piston) instead of spinning up local
 * Docker containers.
 *
 * WHY: the previous implementation shelled out to the `docker` CLI and
 * required a reachable Docker daemon. That works on a host with Docker
 * installed, but it does NOT work on PaaS platforms like Render's standard
 * web services, which have no Docker daemon and no /var/run/docker.sock
 * available -- hence the "failed to connect to the docker API" error. Piston
 * is a free, public, rate-limited execution engine reachable over plain
 * HTTPS, so it works unmodified on Render (or any host with internet
 * access), at zero cost.
 *
 * Trade-offs vs. the old Docker approach:
 *  - No cost, no server to manage.
 *  - It's a shared public instance, so it's rate-limited (roughly a few
 *    requests/second) and each run is capped at a few seconds of CPU time
 *    regardless of what we ask for.
 *  - If you ever outgrow the public instance, Piston is open source and can
 *    be self-hosted -- you'd just point PISTON_URL at your own deployment,
 *    no other code changes required.
 *
 * The public exports (`judgeSubmission`, `runAdHoc`) are unchanged, so
 * submissionController.js and everything else that uses this module keeps
 * working exactly as before.
 */

const TIMEOUT_MS = Number(process.env.CODE_EXEC_TIMEOUT_MS || 5000);
const PISTON_URL = process.env.PISTON_URL || 'https://emkc.org/api/v2/piston/execute';
// The public Piston instance caps run_timeout at a few seconds regardless of
// what we request; keep our own request sane so it isn't rejected outright.
const MAX_RUN_TIMEOUT_MS = 3000;
const MAX_COMPILE_TIMEOUT_MS = 10000;

const LANGUAGE_CONFIG = {
  python: { pistonLanguage: 'python', filename: 'main.py' },
  javascript: { pistonLanguage: 'javascript', filename: 'main.js' },
  cpp: { pistonLanguage: 'cpp', filename: 'main.cpp' },
  java: { pistonLanguage: 'java', filename: 'Main.java' },
};

// Calls the Piston API once: compiles (if needed) and runs `content` with
// `stdin`, returning a shape compatible with what the rest of this file (and
// submissionController.js) already expects.
async function pistonRun({ language, filename, content, stdin, timeoutMs, _retried }) {
  const start = Date.now();
  const runTimeout = Math.min(timeoutMs || TIMEOUT_MS, MAX_RUN_TIMEOUT_MS);

  const body = {
    language,
    version: '*',
    files: [{ name: filename, content }],
    stdin: stdin || '',
    run_timeout: runTimeout,
    compile_timeout: MAX_COMPILE_TIMEOUT_MS,
  };

  let res;
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), runTimeout + MAX_COMPILE_TIMEOUT_MS + 5000);
  try {
    res = await fetch(PISTON_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(abortTimer);
    return {
      stdout: '',
      stderr: `Could not reach the code execution service: ${err.message}`,
      exitCode: -1,
      timedOut: false,
      compileError: null,
      ms: Date.now() - start,
    };
  }
  clearTimeout(abortTimer);

  if (res.status === 429 && !_retried) {
    // Public instance is rate-limited; wait briefly and retry once.
    await new Promise((r) => setTimeout(r, 1200));
    return pistonRun({ language, filename, content, stdin, timeoutMs, _retried: true });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return {
      stdout: '',
      stderr: `Code execution service error (${res.status}): ${text.slice(0, 300)}`,
      exitCode: -1,
      timedOut: false,
      compileError: null,
      ms: Date.now() - start,
    };
  }

  const data = await res.json();
  const ms = Date.now() - start;

  // Compiled languages (cpp/java): a failed compile is reported separately
  // from the run step.
  if (data.compile && data.compile.code !== 0) {
    return {
      stdout: '',
      stderr: '',
      exitCode: -1,
      timedOut: false,
      compileError: (data.compile.stderr || data.compile.output || '').slice(0, 4000),
      ms,
    };
  }

  const run = data.run || {};
  // Piston reports a killed-for-timeout process via a signal with no exit
  // code; normalize that to exitCode 124, matching the old `timeout <secs>`
  // shell-wrapper convention the rest of this file already relies on.
  const timedOut = run.signal === 'SIGKILL' || run.code === null || run.code === undefined;

  return {
    stdout: run.stdout || '',
    stderr: run.stderr || '',
    exitCode: timedOut ? 124 : run.code,
    timedOut,
    compileError: null,
    ms,
  };
}

/**
 * Runs `code` in `language` against a list of test cases via Piston.
 * testCases: [{ input, output }]
 */
async function judgeSubmission({ language, code, testCases, timeLimitMs }) {
  const config = LANGUAGE_CONFIG[language];
  if (!config) {
    return { verdict: 'Internal Error', passedTestCases: 0, totalTestCases: testCases.length, executionTimeMs: 0, log: `Unsupported language: ${language}` };
  }

  const effectiveMs = Math.max(1000, timeLimitMs || TIMEOUT_MS);

  let passed = 0;
  let maxMs = 0;

  for (const tc of testCases) {
    const result = await pistonRun({
      language: config.pistonLanguage,
      filename: config.filename,
      content: code,
      stdin: tc.input,
      timeoutMs: effectiveMs,
    });

    if (result.compileError) {
      return { verdict: 'Compilation Error', passedTestCases: 0, totalTestCases: testCases.length, executionTimeMs: 0, log: result.compileError };
    }

    maxMs = Math.max(maxMs, result.ms);

    if (result.timedOut) {
      return {
        verdict: 'Time Limit Exceeded',
        passedTestCases: passed,
        totalTestCases: testCases.length,
        executionTimeMs: maxMs,
        log: `Your program did not finish within the time limit on test case ${passed + 1}.`,
      };
    }
    if (result.exitCode === -1) {
      return { verdict: 'Internal Error', passedTestCases: passed, totalTestCases: testCases.length, executionTimeMs: maxMs, log: result.stderr };
    }
    if (result.exitCode !== 0) {
      return { verdict: 'Runtime Error', passedTestCases: passed, totalTestCases: testCases.length, executionTimeMs: maxMs, log: result.stderr.slice(0, 2000) };
    }
    if (result.stdout.trim() !== tc.output.trim()) {
      return {
        verdict: 'Wrong Answer',
        passedTestCases: passed,
        totalTestCases: testCases.length,
        executionTimeMs: maxMs,
        log: `Test case ${passed + 1} failed.\nInput:\n${tc.input}\n\nExpected output:\n${tc.output}\n\nYour output:\n${result.stdout || '(no output)'}`,
      };
    }
    passed += 1;
  }

  return { verdict: 'Accepted', passedTestCases: passed, totalTestCases: testCases.length, executionTimeMs: maxMs, log: 'All test cases passed.' };
}

/**
 * Compiles (if needed) and runs `code` once against a single arbitrary
 * `input`, returning raw stdout/stderr -- backs the "Run" button.
 */
async function runAdHoc({ language, code, input }) {
  const config = LANGUAGE_CONFIG[language];
  if (!config) {
    return { stdout: '', stderr: `Unsupported language: ${language}`, exitCode: -1, timedOut: false, ms: 0 };
  }

  const result = await pistonRun({
    language: config.pistonLanguage,
    filename: config.filename,
    content: code,
    stdin: input,
    timeoutMs: TIMEOUT_MS,
  });

  if (result.compileError) {
    return { stdout: '', stderr: result.compileError, exitCode: -1, timedOut: false, ms: result.ms };
  }

  return result;
}

module.exports = { judgeSubmission, runAdHoc };