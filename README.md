# Fortran — Online Judge

A full-stack online judge platform: solve coding problems, submit solutions
in Python, C++, Java, or JavaScript, and get graded inside an isolated Docker
sandbox. Compete in rated contests with a live leaderboard, track progress
with a submission streak calendar and a contest rating history graph, and
race against a real async judging queue built to handle many simultaneous
submissions.

## Features

- **User accounts** with JWT authentication
- **Practice problems** with per-problem test cases and real acceptance-rate stats
- **Docker-sandboxed code execution** — every submission compiles and runs
  inside a disposable, network-isolated, memory- and CPU-capped container
  (no network access, non-root user, destroyed immediately after use)
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
- **Code execution:** Docker (a dedicated `oj-code-runner` sandbox image)
- **Auth:** JWT + bcrypt

## Architecture

```
Fortran/
  backend/    Express API, MongoDB models, code judge, submission queue
  frontend/   React (Vite) single-page app
```

Submissions are evaluated by spawning short-lived Docker containers rather
than running arbitrary user code on the host — each submission gets its own
container with `--network none`, a memory cap, a CPU cap, a process-count
cap, and a non-root user, and the container is destroyed immediately on
exit. Because the backend can itself run inside a container (see the Docker
Compose setup below), submission files are shared with sandbox containers
through a named Docker volume rather than a host bind mount, which is what
makes this work correctly under Docker-outside-of-Docker.

## Prerequisites

- Node.js 18+
- Docker Desktop (Mac/Windows) or Docker Engine (Linux) — required, since
  all code execution happens in containers
- MongoDB (local, MongoDB Atlas, or the bundled `docker-compose` service)

## Getting started

### 1. Build the sandbox image (required once)

```bash
git clone <this-repo-url>
cd Fortran
docker build -t oj-code-runner:latest -f backend/docker/runner.Dockerfile backend/docker
```

### 2. Run the stack

**Option A — everything in Docker:**

```bash
docker compose up --build
docker compose exec backend npm run seed   # creates a sample admin account + 2 problems
```

Then open `http://localhost:5173`.

**Option B — Node on the host, Docker only for the sandbox:**

```bash
# Backend
cd backend
cp .env.example .env   # fill in MONGO_URI and JWT_SECRET
npm install
npm run seed
npm run dev

# Frontend (separate terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

### Environment variables

**`backend/.env`**

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign auth tokens |
| `PORT` | API server port (default 5000) |
| `CLIENT_ORIGIN` | Allowed frontend origin(s) for CORS |
| `CODE_EXEC_TIMEOUT_MS` | Per-test-case execution timeout |
| `RUNNER_IMAGE` | Sandbox image tag (default `oj-code-runner:latest`) |
| `DOCKER_MEMORY_LIMIT_MB` / `DOCKER_CPU_LIMIT` / `DOCKER_PIDS_LIMIT` | Sandbox container resource limits |

**`frontend/.env`**

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the backend API |

When running via `docker-compose.yml`, set `JWT_SECRET` in a `.env` file at
the project root (used for variable substitution in the compose file) rather
than in `backend/.env`, which the containerized backend does not read.

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
- **Backend:** needs a host with a real Docker daemon available to it — a
  small VM (DigitalOcean, Linode, Lightsail) with Docker installed works
  well with `docker compose up -d`. Serverless/managed-container platforms
  generally do not expose a Docker daemon to your container and will not be
  able to run the sandbox.
- **Database:** MongoDB Atlas (free tier is sufficient for light use).

## Known limitations

- Plagiarism detection uses n-gram similarity rather than a
  winnowing/fingerprinting algorithm like MOSS — effective against
  copy-paste and light edits, less so against heavily restructured code.
- Contest screen recording is not enforced server-side; a submission is not
  blocked if no active recording exists.
- Sandbox isolation uses standard Docker containers, not a stronger
  isolation layer (gVisor/Firecracker) — sufficient for a learning/portfolio
  deployment, worth upgrading before handling adversarial, high-stakes
  submissions at scale.

## License

MIT
