/**
 * Executes untrusted user code as a locked-down OS subprocess, directly
 * inside this same container -- no Docker, no external sandbox containers,
 * no Docker daemon required at runtime.
 *
 * WHY: the original design ran each submission inside a disposable Docker
 * container (`docker run --network none --memory ... --cpus ...`). That's
 * the more secure approach, but it requires a reachable Docker daemon,
 * which plain free-tier hosts (like a standard Render web service) don't
 * provide. This version trades some isolation for running anywhere with
 * just Node + the language runtimes installed (see backend/Dockerfile).
 *
 * Sandboxing here is done with, layered together:
 *  - a dedicated unprivileged OS user ("sandbox", created in the
 *    Dockerfile) that submitted code runs as -- never the same user as the
 *    Express server itself
 *  - `ulimit` caps on CPU time, virtual memory, and max file size
 *  - a hard `timeout` wrapper around the actual run, plus a Node-side
 *    SIGKILL safety net in case that somehow doesn't fire
 *  - each submission gets its own throwaway temp directory, deleted after
 *    grading
 *
 * IMPORTANT CAVEAT: this is NOT the same level of isolation as a real
 * container. There's no network namespace isolation and no filesystem
 * isolation beyond the OS's own user/permission boundaries. It's a
 * reasonable fit for a personal/academic project judging trusted-ish
 * submissions, not a hardened sandbox for a large public-facing judge.
 *
 * Public exports (`judgeSubmission`, `runAdHoc`) are unchanged, so
 * submissionController.js keeps working exactly as before.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const TIMEOUT_MS = Number(process.env.CODE_EXEC_TIMEOUT_MS || 5000);
const MEMORY_LIMIT_MB = Number(process.env.SANDBOX_MEMORY_LIMIT_MB || 256);
const MAX_FILE_SIZE_KB = Number(process.env.SANDBOX_MAX_FILE_KB || 51200); // 50MB

// UID/GID of the unprivileged user created in the Dockerfile. The Express
// server itself keeps running as root (node:20-slim's default), which is
// what lets it drop privileges down to this user for each spawned process --
// only requires root when *starting* the child, the child itself runs
// unprivileged.
const SANDBOX_UID = Number(process.env.SANDBOX_UID || 1000);
const SANDBOX_GID = Number(process.env.SANDBOX_GID || 1000);

const LANGUAGE_CONFIG = {
  python: {
    filename: 'main.py',
    runCmd: (secs) => `timeout ${secs}s python3 main.py`,
  },
  javascript: {
    filename: 'main.js',
    runCmd: (secs) => `timeout ${secs}s node main.js`,
  },
  cpp: {
    filename: 'main.cpp',
    compileCmd: () => `timeout 15s g++ main.cpp -O2 -o a.out`,
    runCmd: (secs) => `timeout ${secs}s ./a.out`,
    skipMemLimit: false,
  },
  java: {
    filename: 'Main.java',
    compileCmd: () => `timeout 20s javac Main.java`,
    // The JVM reserves a large virtual-memory footprint on startup regardless
    // of actual heap usage, so a `ulimit -v` cap would kill it immediately.
    // -Xmx bounds the heap instead, and we skip the virtual-memory ulimit
    // for java specifically (see wrapWithLimits below).
    runCmd: (secs) => `timeout ${secs}s java -Xmx${MEMORY_LIMIT_MB}m -cp . Main`,
    skipMemLimit: true,
  },
};

function prepareWorkDir(submissionId) {
  const writePath = fs.mkdtempSync(path.join(os.tmpdir(), `oj-${submissionId}-`));
  // sandbox user needs to read/write/execute here (source file, compiled
  // binary/class files, etc.) even though the directory is owned by root.
  fs.chmodSync(writePath, 0o777);
  return writePath;
}

function cleanupWorkDir(writePath) {
  fs.rmSync(writePath, { recursive: true, force: true });
}

// Wraps `cmd` with ulimit guards executed in the same shell, so they apply
// to the process (and its children) that `exec`s into `cmd`.
// NOTE: we deliberately do NOT set `ulimit -u` (RLIMIT_NPROC / process-count
// cap) here. On shared multi-tenant hosts without per-container user
// namespace isolation (common on PaaS free tiers), that limit is tracked
// against the UID at the *host* level rather than scoped to this container,
// so a small cap gets exhausted by unrelated processes from other tenants
// and causes spurious "fork: Resource temporarily unavailable" failures
// before user code even runs. CPU time (-t) and virtual memory (-v) are
// enforced per-process instead, so they don't have this problem, and the
// outer `timeout` wrapper still bounds worst-case damage from something
// like a fork bomb to the wall-clock time limit.
function wrapWithLimits(cmd, { timeoutSecs, skipMemLimit }) {
  const limits = [`ulimit -f ${MAX_FILE_SIZE_KB}`, `ulimit -t ${timeoutSecs + 2}`];
  if (!skipMemLimit) limits.push(`ulimit -v ${MEMORY_LIMIT_MB * 1024}`);
  return `${limits.join('; ')}; exec ${cmd}`;
}

// Runs `shellCmd` as the unprivileged sandbox user inside `cwd`.
function sandboxRun({ shellCmd, cwd, input, timeoutMs, skipMemLimit }) {
  return new Promise((resolve) => {
    const start = Date.now();
    const timeoutSecs = Math.max(1, Math.ceil(timeoutMs / 1000));
    const wrapped = wrapWithLimits(shellCmd, { timeoutSecs, skipMemLimit });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const child = spawn('bash', ['-c', wrapped], {
      cwd,
      uid: SANDBOX_UID,
      gid: SANDBOX_GID,
      env: { PATH: process.env.PATH, HOME: cwd },
    });

    // Node-side safety net in case the in-shell `timeout` somehow doesn't
    // fire (e.g. the process ignores SIGTERM).
    const killTimer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch (_) {
        /* already exited */
      }
    }, timeoutMs + 3000);

    child.stdin.on('error', () => {});
    child.stdin.write(input || '');
    child.stdin.end();

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      resolve({
        stdout,
        stderr: `Sandbox error: ${err.message}`,
        exitCode: -1,
        timedOut: false,
        ms: Date.now() - start,
      });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      resolve({ stdout, stderr, exitCode: code, timedOut: code === 124, ms: Date.now() - start });
    });
  });
}

/**
 * Runs `code` in `language` against a list of test cases, entirely as
 * sandboxed subprocesses.
 * testCases: [{ input, output }]
 */
async function judgeSubmission({ language, code, testCases, timeLimitMs }) {
  const config = LANGUAGE_CONFIG[language];
  if (!config) {
    return { verdict: 'Internal Error', passedTestCases: 0, totalTestCases: testCases.length, executionTimeMs: 0, log: `Unsupported language: ${language}` };
  }

  const submissionId = uuidv4();
  const writePath = prepareWorkDir(submissionId);
  const effectiveSecs = Math.max(1, Math.ceil((timeLimitMs || TIMEOUT_MS) / 1000));

  try {
    fs.writeFileSync(path.join(writePath, config.filename), code, 'utf8');
    fs.chmodSync(path.join(writePath, config.filename), 0o666);

    if (config.compileCmd) {
      const compileResult = await sandboxRun({
        shellCmd: config.compileCmd(),
        cwd: writePath,
        input: '',
        timeoutMs: 15000,
        skipMemLimit: config.skipMemLimit,
      });
      if (compileResult.exitCode !== 0) {
        return {
          verdict: 'Compilation Error',
          passedTestCases: 0,
          totalTestCases: testCases.length,
          executionTimeMs: 0,
          log: (compileResult.stderr || compileResult.stdout).slice(0, 4000),
        };
      }
    }

    let passed = 0;
    let maxMs = 0;

    for (const tc of testCases) {
      const result = await sandboxRun({
        shellCmd: config.runCmd(effectiveSecs),
        cwd: writePath,
        input: tc.input,
        timeoutMs: effectiveSecs * 1000,
        skipMemLimit: config.skipMemLimit,
      });
      maxMs = Math.max(maxMs, result.ms);

      if (result.exitCode === 124) {
        return {
          verdict: 'Time Limit Exceeded',
          passedTestCases: passed,
          totalTestCases: testCases.length,
          executionTimeMs: maxMs,
          log: `Your program did not finish within the ${effectiveSecs}s time limit on test case ${passed + 1}.`,
        };
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
  } catch (err) {
    return { verdict: 'Internal Error', passedTestCases: 0, totalTestCases: testCases.length, executionTimeMs: 0, log: err.message };
  } finally {
    cleanupWorkDir(writePath);
  }
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

  const submissionId = uuidv4();
  const writePath = prepareWorkDir(submissionId);

  try {
    fs.writeFileSync(path.join(writePath, config.filename), code, 'utf8');
    fs.chmodSync(path.join(writePath, config.filename), 0o666);

    if (config.compileCmd) {
      const compileResult = await sandboxRun({
        shellCmd: config.compileCmd(),
        cwd: writePath,
        input: '',
        timeoutMs: 15000,
        skipMemLimit: config.skipMemLimit,
      });
      if (compileResult.exitCode !== 0) {
        return { stdout: '', stderr: compileResult.stderr || compileResult.stdout, exitCode: compileResult.exitCode, timedOut: false, ms: 0 };
      }
    }

    const runSecs = Math.max(1, Math.ceil(TIMEOUT_MS / 1000));
    const result = await sandboxRun({
      shellCmd: config.runCmd(runSecs),
      cwd: writePath,
      input,
      timeoutMs: runSecs * 1000,
      skipMemLimit: config.skipMemLimit,
    });
    return result;
  } catch (err) {
    return { stdout: '', stderr: err.message, exitCode: -1, timedOut: false, ms: 0 };
  } finally {
    cleanupWorkDir(writePath);
  }
}

module.exports = { judgeSubmission, runAdHoc };
