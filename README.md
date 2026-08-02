# Fortran — Online Judge

A full-stack online judge platform: solve coding problems, submit solutions
in Python, C++, Java, or JavaScript, and get graded inside a locked-down
sandbox. Compete in rated contests with a live leaderboard, track progress
with a submission streak calendar and a contest rating history graph, and
race against a real async judging queue built to handle many simultaneous
submissions.

## Features

- **User accounts** with JWT authentication
- **Practice problems** with per-problem test cases and real acceptance-rate stats
- **Sandboxed code execution** — every submission compiles and runs as an
  unprivileged OS subprocess, capped on CPU time and memory, and killed by a
  hard timeout if it runs too long
- **Async submission queue** to absorb bursts of simultaneous submissions
  without overloading the judge
- **Run vs. Submit** — test code against custom input without it counting as
  a graded attempt
- **Rated contests** with a live leaderboard, contest registration, and an
  Elo-style rating update on finalization
- **Global leaderboard** ranked by real contest rating, with Codeforces-style
  rank titles (Newbie → Grandmaster) derived from that rating
- **Profile pages** with a LeetCode-style activity heatmap, a real computed
  submission streak, and a rating history graph
- **Screen recording** during live contests (browser MediaRecorder API)
- **Plagiarism detection** — n-gram similarity checking between submissions
  to the same contest problem
- **Admin tooling** built into the UI for creating problems and contests —
  no API client required for day-to-day use

## Tech stack

- **Frontend:** React (Vite), React Router, Recharts
- **Backend:** Node.js, Express, MongoDB (Mongoose)
- **Code execution:** unprivileged OS subprocesses (Python3 / g++ / OpenJDK /
  Node) with `ulimit`-based CPU and memory caps and a hard `timeout`
  wrapper — no Docker daemon required at runtime, so it runs on plain
  free-tier hosts (see [Architecture](#architecture) below)
- **Auth:** JWT + bcrypt

## Architecture

```
Fortran/
  backend/    Express API, MongoDB models, code judge, submission queue
  frontend/   React (Vite) single-page app
```

Submissions are evaluated by `backend/services/codeExecutor.js`, which runs
each submission's compile/run step directly inside the backend's own
container as a subprocess, executed as the unprivileged `node` user (never
the same user the Express server itself runs as). Each run is wrapped with:

- `ulimit -t` (CPU time) and `ulimit -v` (virtual memory) caps
- `ulimit -f` to cap how much a submission can write to disk
- a `timeout` wrapper enforcing the problem's time limit, plus a Node-side
  `SIGKILL` safety net in case that doesn't fire
- its own throwaway temp directory per submission, deleted after grading

This intentionally trades some isolation for portability: it needs nothing
beyond Node + the language runtimes installed in the image (see
`backend/Dockerfile`), so it runs on any host that can run a Docker image —
including free-tier PaaS platforms (Render, etc.) that don't expose a Docker
daemon to the app itself. It is **not** the same level of isolation as
running each submission in its own disposable container (there's no network
or filesystem namespace isolation beyond normal OS user permissions) — a
reasonable fit for a personal/academic deployment, but worth hardening
before judging fully adversarial submissions at public scale. See
[Known limitations](#known-limitations).

> An earlier version of this project ran each submission inside a disposable
> Docker container via `docker run` (see git history / the code comments in
> `codeExecutor.js`). That approach is more isolated, but requires a host
> with a reachable Docker daemon, which most managed free-tier platforms
> don't provide to the application container. The `docker-compose.yml` and
> `backend/docker/runner.Dockerfile` files are kept for reference/local
> experimentation but are not part of the current deployment path.

## Prerequisites

- Node.js 18+
- MongoDB (local or MongoDB Atlas)
- Python 3, g++, and a JDK available on `PATH` if running the backend
  directly on your host (`backend/Dockerfile` installs these automatically
  if you run the backend as a container instead)

## Getting started

### Run the backend + frontend

```bash
git clone <this-repo-url>
cd Fortran

# Backend
cd backend
cp .env.example .env   # fill in MONGO_URI and JWT_SECRET
npm install
npm run seed            # creates a sample admin account + 2 problems
npm run dev

# Frontend (separate terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

Then open `http://localhost:5173`.

If you'd rather run the backend as a container (which bundles Python/g++/JDK
for you automatically), build and run `backend/Dockerfile` directly:

```bash
cd backend
docker build -t fortran-backend .
docker run --env-file .env -p 5000:5000 fortran-backend
```

### Environment variables

**`backend/.env`**

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign auth tokens |
| `PORT` | API server port (default 5000) |
| `CLIENT_ORIGIN` | Allowed frontend origin(s) for CORS |
| `CODE_EXEC_TIMEOUT_MS` | Default per-test-case execution timeout |
| `SANDBOX_MEMORY_LIMIT_MB` | Virtual memory cap per submission (default 256) |
| `SANDBOX_MAX_FILE_KB` | Max bytes a submission may write to disk (default 51200) |
| `SANDBOX_UID` / `SANDBOX_GID` | OS user/group submissions run as (default 1000, the built-in `node` user in `backend/Dockerfile`) |

**`frontend/.env`**

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the backend API |

## API overview

All endpoints are prefixed with `/api`.

| Method | Route | Description |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | Account creation and login |
| GET | `/auth/me` | Current user |
| GET | `/problems` | List practice problems |
| GET | `/problems/:code` | Problem detail + sample test cases |
| POST | `/problems` | Create a problem (admin) |
| POST | `/submissions` | Submit a solution for grading |
| GET | `/submissions/:id` | Poll a submission's verdict |
| GET | `/submissions` | List your own submissions |
| GET | `/submissions/stats` | Aggregate verdict stats for your account |
| POST | `/submissions/run` | Run code against custom input (ungraded) |
| GET | `/contests` | List contests |
| POST | `/contests` | Create a contest (admin) |
| POST | `/contests/:id/register` | Register for a contest |
| GET | `/contests/:id/leaderboard` | Contest leaderboard |
| POST | `/contests/:id/finalize` | Lock a contest and update ratings (admin) |
| GET | `/leaderboard` | Global leaderboard |
| GET | `/profile/:userId` | Public profile |
| POST | `/recordings` | Upload a contest screen recording |

## Deployment

- **Frontend:** any static host (Vercel, Netlify) that can build a Vite app.
- **Backend:** any host that can build and run `backend/Dockerfile` — no
  Docker daemon needs to be reachable from inside the app itself, since code
  execution now happens as sandboxed subprocesses in the same container.
  This is what makes it deployable on free-tier platforms like Render
  (deploy it as a Docker-based web service, not the auto-detected Node
  runtime, so the image actually installs Python/g++/JDK).
- **Database:** MongoDB Atlas (free tier is sufficient for light use).

## Known limitations

- Plagiarism detection uses n-gram similarity rather than a
  winnowing/fingerprinting algorithm like MOSS — effective against
  copy-paste and light edits, less so against heavily restructured code.
- Contest screen recording is not enforced server-side; a submission is not
  blocked if no active recording exists.
- Sandbox isolation is OS-user + `ulimit`-based, not container/VM-level
  isolation — there's no network or filesystem namespace isolation beyond
  standard Unix permissions. Sufficient for a learning/portfolio deployment
  with trusted-ish users; worth upgrading to per-submission containers or a
  stronger isolation layer (gVisor/Firecracker) plus network isolation
  before handling adversarial, high-stakes submissions at public scale.
- Process-count limiting (fork-bomb protection via `ulimit -u`) is
  intentionally not used — on shared multi-tenant hosts without
  per-container user-namespace isolation, that limit is tracked at the host
  level and gets exhausted by unrelated processes, causing false failures.
  The CPU-time and wall-clock `timeout` caps still bound worst-case impact.

## License

MIT