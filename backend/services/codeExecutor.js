/**
 * Executes untrusted user code inside a disposable, locked-down Docker
 * container -- this IS the "Custom Isolation using Docker" solution the HLD
 * doc calls for.
 *
 * Every compile step and every test-case run is its own `docker run`
 * invocation against the `oj-code-runner` image (see backend/docker/runner.Dockerfile),
 * with:
 *   --network none        no network access at all
 *   --memory / --memory-swap   hard memory cap (default 256m)
 *   --cpus                 hard CPU cap (default 0.5 cores)
 *   --pids-limit            caps forked processes (fork-bomb protection)
 *   --user 1000:1000        non-root inside the container
 *   --rm                    container is destroyed the instant it exits
 *
 * TWO WAYS THE SUBMISSION FILE IS SHARED WITH THE SANDBOX CONTAINER,
 * depending on how the backend itself is running:
 *
 * 1. Option A - this backend process runs directly on the host (`npm run dev`).
 *    A host temp directory is bind-mounted straight into the sandbox
 *    container (`-v <hostTempDir>:/box`). This is the simple, default case:
 *    no SANDBOX_VOLUME_NAME env var is set.
 *
 * 2. Option B - this backend runs inside its OWN Docker container (docker
 *    compose), talking to the HOST's Docker daemon over a mounted socket
 *    (Docker-outside-of-Docker). In this mode a bind-mounted path would be a
 *    path *inside the backend container*, which the host daemon can't see --
 *    so instead we write submission files into a *named Docker volume*
 *    (`oj_sandbox_tmp`, mounted at /sandbox in both this container and every
 *    spawned sandbox container). Named volumes are addressed by name, not
 *    host path, so they work correctly across this container boundary. This
 *    mode is enabled by setting SANDBOX_VOLUME_NAME (docker-compose.yml does
 *    this for you).
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const TIMEOUT_MS = Number(process.env.CODE_EXEC_TIMEOUT_MS || 5000);
const RUNNER_IMAGE = process.env.RUNNER_IMAGE || 'oj-code-runner:latest';
const MEMORY_LIMIT_MB = Number(process.env.DOCKER_MEMORY_LIMIT_MB || 256);
const CPU_LIMIT = process.env.DOCKER_CPU_LIMIT || '0.5';
const PIDS_LIMIT = Number(process.env.DOCKER_PIDS_LIMIT || 64);

// Named-volume (Option B / docker-compose) mode settings
const SANDBOX_VOLUME_NAME = process.env.SANDBOX_VOLUME_NAME || null;
const SANDBOX_MOUNT_PATH = process.env.SANDBOX_MOUNT_PATH || '/sandbox';

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
  },
  java: {
    filename: 'Main.java',
    compileCmd: () => `timeout 20s javac Main.java`,
    runCmd: (secs) => `timeout ${secs}s java -cp . Main`,
  },
};

// Creates the per-submission working directory and returns:
//  - writePath: where THIS process (Node) should write/read files
//  - volumeArgs: the `-v ...` docker CLI args to give the sandbox container
//    the same files at the same relative location
//  - containerWorkdir: the `-w` path to pass to the sandbox container
function prepareWorkDir(submissionId) {
  if (SANDBOX_VOLUME_NAME) {
    // Named-volume mode: write into our own mount of the shared volume,
    // under a per-submission subfolder; hand the sandbox container the same
    // volume (by name) plus that subfolder as its working directory.
    const writePath = path.join(SANDBOX_MOUNT_PATH, submissionId);
    fs.mkdirSync(writePath, { recursive: true });
    fs.chmodSync(writePath, 0o777);
    return {
      writePath,
      volumeArgs: ['-v', `${SANDBOX_VOLUME_NAME}:${SANDBOX_MOUNT_PATH}`],
      containerWorkdir: `${SANDBOX_MOUNT_PATH}/${submissionId}`,
    };
  }

  // Bind-mount mode: a real host directory, mounted 1:1 into the sandbox container.
  const writePath = fs.mkdtempSync(path.join(os.tmpdir(), `oj-${submissionId}-`));
  fs.chmodSync(writePath, 0o777);
  return {
    writePath,
    volumeArgs: ['-v', `${writePath}:/box`],
    containerWorkdir: '/box',
  };
}

function cleanupWorkDir(writePath) {
  fs.rmSync(writePath, { recursive: true, force: true });
}

// Runs `shellCmd` inside a fresh, locked-down oj-code-runner container.
function dockerRun({ shellCmd, volumeArgs, containerWorkdir, input, timeoutMs }) {
  return new Promise((resolve) => {
    const start = Date.now();
    const containerName = `oj-${uuidv4()}`;

    const args = [
      'run',
      '--rm',
      '-i',
      '--name', containerName,
      '--network', 'none',
      '--memory', `${MEMORY_LIMIT_MB}m`,
      '--memory-swap', `${MEMORY_LIMIT_MB}m`,
      '--cpus', CPU_LIMIT,
      '--pids-limit', String(PIDS_LIMIT),
      ...volumeArgs,
      '-w', containerWorkdir,
      RUNNER_IMAGE,
      'sh', '-c', shellCmd,
    ];

    let stdout = '';
    let stderr = '';
    let settled = false;

    const child = spawn('docker', args);

    const killTimer = setTimeout(() => {
      spawn('docker', ['kill', containerName]); // best-effort, fire and forget
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
        stderr: `Docker error: ${err.message}. Is Docker running and the "${RUNNER_IMAGE}" image built?`,
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
 * Runs `code` in `language` against a list of test cases, entirely inside
 * disposable Docker containers.
 * testCases: [{ input, output }]
 */
async function judgeSubmission({ language, code, testCases, timeLimitMs }) {
  const config = LANGUAGE_CONFIG[language];
  if (!config) {
    return { verdict: 'Internal Error', passedTestCases: 0, totalTestCases: testCases.length, executionTimeMs: 0, log: `Unsupported language: ${language}` };
  }

  const submissionId = uuidv4();
  const { writePath, volumeArgs, containerWorkdir } = prepareWorkDir(submissionId);
  const effectiveSecs = Math.max(1, Math.ceil((timeLimitMs || TIMEOUT_MS) / 1000));

  try {
    fs.writeFileSync(path.join(writePath, config.filename), code, 'utf8');

    if (config.compileCmd) {
      const compileResult = await dockerRun({
        shellCmd: config.compileCmd(),
        volumeArgs,
        containerWorkdir,
        input: '',
        timeoutMs: 15000,
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
      const result = await dockerRun({
        shellCmd: config.runCmd(effectiveSecs),
        volumeArgs,
        containerWorkdir,
        input: tc.input,
        timeoutMs: effectiveSecs * 1000,
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
 * `input`, returning raw stdout/stderr -- no test cases, no verdict, no
 * persistence. This is what backs the "Run" button (as opposed to "Submit"),
 * same sandboxing as judgeSubmission, just without grading.
 */
async function runAdHoc({ language, code, input }) {
  const config = LANGUAGE_CONFIG[language];
  if (!config) {
    return { stdout: '', stderr: `Unsupported language: ${language}`, exitCode: -1, timedOut: false, ms: 0 };
  }

  const submissionId = uuidv4();
  const { writePath, volumeArgs, containerWorkdir } = prepareWorkDir(submissionId);

  try {
    fs.writeFileSync(path.join(writePath, config.filename), code, 'utf8');

    if (config.compileCmd) {
      const compileResult = await dockerRun({ shellCmd: config.compileCmd(), volumeArgs, containerWorkdir, input: '', timeoutMs: 15000 });
      if (compileResult.exitCode !== 0) {
        return { stdout: '', stderr: compileResult.stderr || compileResult.stdout, exitCode: compileResult.exitCode, timedOut: false, ms: 0 };
      }
    }

    const runSecs = Math.max(1, Math.ceil(TIMEOUT_MS / 1000));
    const result = await dockerRun({ shellCmd: config.runCmd(runSecs), volumeArgs, containerWorkdir, input, timeoutMs: runSecs * 1000 });
    return result;
  } catch (err) {
    return { stdout: '', stderr: err.message, exitCode: -1, timedOut: false, ms: 0 };
  } finally {
    cleanupWorkDir(writePath);
  }
}

module.exports = { judgeSubmission, runAdHoc };
