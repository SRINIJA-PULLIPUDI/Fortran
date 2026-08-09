# Fortran — Online Judge

A full-stack competitive programming platform: solve coding problems, submit
solutions in Python, C++, Java, or JavaScript, and get graded inside a
locked-down sandbox. Compete in rated contests with a live leaderboard, a
real speed- and accuracy-aware rating system, a submission streak calendar,
and a global leaderboard ranked by real performance.

- **Live site:** https://fortran.vercel.app
- **API:** https://fortran.onrender.com
- **Source:** https://github.com/SRINIJA-PULLIPUDI/Fortran

## Features

- **User accounts** with JWT authentication and in-app password changes
- **Practice problems** — sequentially numbered, with real acceptance-rate
  stats computed from actual submissions, and a filter bar (difficulty,
  topic tag, minimum acceptance %, exact problem number, free-text search)
- **Sandboxed code execution** — every submission compiles and runs as an
  unprivileged OS subprocess, capped on CPU time and memory, killed by a
  hard timeout if it runs too long (see [Architecture](#architecture))
- **Async submission queue** to absorb bursts of simultaneous submissions
- **Run vs. Submit** — test code against custom input without it counting
  as a graded attempt
- **A real code editor** — syntax highlighting (keywords, strings,
  comments, numbers), rainbow bracket coloring by nesting depth,
  auto-closing brackets/quotes, and indent-aware Tab/Enter handling
- **Rated contests**, authored inline (problems are written specifically
  for a contest, not picked from the existing catalog) — their tags and
  hints stay hidden until the contest ends, then they're promoted into the
  public practice bank continuing the site-wide problem numbering
- **Live contest countdown** while solving a problem, and hard server-side
  enforcement that no submission is accepted once a contest's end time has
  passed — so the leaderboard and rating calculation can never be skewed by
  a late submission
- **Performance-aware contest rating** — rating changes account for how
  many problems you solved, how fast you solved them relative to the
  contest window, a penalty for wrong submissions before solving, and
  partial credit for problems you got partway through but never fully
  solved (see [Contest rating](#contest-rating))
- **Global and per-contest leaderboards**, ranked by rating → problems
  solved → (contest board only) total solve time → acceptance rate — admin
  accounts never appear on either, since the problem setter isn't a
  competitor
- **Profile pages** with a LeetCode-style activity heatmap, a computed
  submission streak, and a rating history graph
- **Plagiarism detection** — n-gram similarity checking between submissions
  to the same contest problem
- **Admin tooling** built into the UI — create, edit, and delete problems
  and author contests, all without an API client

## Architecture

```
Fortran/
  backend/    Express API, MongoDB models, code judge, submission queue
  frontend/   React (Vite) single-page app
```

**Code execution.** Submissions are evaluated by
`backend/services/codeExecutor.js`, which runs each submission's
compile/run step directly inside the backend's own container as a
subprocess, executed as the unprivileged `node` user (never the same user
the Express server runs as). Each run is wrapped with:

- `ulimit -t` (CPU time) and `ulimit -v` (virtual memory) caps
- `ulimit -f` to cap how much a submission can write to disk
- a `timeout` wrapper enforcing the problem's time limit, plus a Node-side
  `SIGKILL` safety net
- its own throwaway temp directory per submission, deleted after grading

This trades some isolation for portability: it needs nothing beyond Node +
the language runtimes installed in the image (see `backend/Dockerfile`), so
it runs on any host that can run a Docker image — including free-tier PaaS
platforms (Render) that don't expose a Docker daemon to the app itself.
It's not the same level of isolation as a disposable container per
submission (no network/filesystem namespace isolation beyond normal OS
permissions) — a reasonable fit for this deployment, worth hardening before
judging fully adversarial submissions at public scale.

## Contest rating

Rating updates (`backend/utils/rating.js` + `backend/utils/scoring.js`) are
a simplified Codeforces-style ELO update, driven by a real per-contest
performance score rather than a plain solved-count:

- A solved problem earns full credit **plus a speed bonus** (up to +30%)
  for solving early in the contest window
- Each wrong submission on a problem **before** solving it costs points
- A problem attempted but never solved still earns **partial credit**,
  capped at half value, scaled by the best fraction of test cases passed
- That total score (0–1, relative to the max possible) is compared against
  the ratings of the contest's other participants (Elo-style) to compute
  each participant's rating change

Two users who solved the same number of problems can end up with different
rating changes if one was faster or made fewer wrong attempts.

## Prerequisites

- Node.js 18+
- MongoDB (local or MongoDB Atlas)
- Python 3, g++, and a JDK available on `PATH` if running the backend
  directly on your host (`backend/Dockerfile` installs these automatically
  if you run the backend as a container instead)

## Getting started

### Run the backend + frontend

```bash
git clone https://github.com/SRINIJA-PULLIPUDI/Fortran.git
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
| PUT | `/auth/change-password` | Change your own password |
| GET | `/problems` | List practice problems (supports `difficulty`, `tags`, `minAcceptance`, `number` filters) |
| GET | `/problems/:code` | Problem detail + sample test cases (tags/hints withheld for un-finalized contest problems) |
| GET | `/problems/:code/edit` | Full problem detail + all test cases (admin) |
| POST | `/problems` | Create a standalone problem (admin) |
| PUT | `/problems/:code` | Edit a problem, optionally replacing its test cases (admin) |
| DELETE | `/problems/:code` | Delete a problem (admin) |
| POST | `/submissions` | Submit a solution for grading (rejected with 403 if the contest it belongs to has already ended) |
| GET | `/submissions/:id` | Poll a submission's verdict |
| GET | `/submissions` | List your own submissions |
| GET | `/submissions/stats` | Aggregate verdict stats for your account |
| POST | `/submissions/run` | Run code against custom input (ungraded) |
| GET | `/contests` | List contests |
| POST | `/contests` | Create a contest with inline-authored problems (admin) |
| GET | `/contests/:id` | Single contest detail (used for the live countdown while solving) |
| POST | `/contests/:id/register` | Register for a contest |
| GET | `/contests/:id/leaderboard` | Contest leaderboard (admins excluded) |
| POST | `/contests/:id/finalize` | Lock a contest, update ratings, promote its problems into the public bank (admin) |
| GET | `/leaderboard` | Global leaderboard (admins excluded) |
| GET | `/profile/:userId` | Public profile |

## Deployment

- **Frontend:** Vercel — https://fortran.vercel.app
- **Backend:** Render, deployed as a Docker-based web service (not the
  auto-detected Node runtime, so the image actually installs
  Python/g++/JDK) — https://fortran.onrender.com. No Docker daemon needs to
  be reachable from inside the app itself, since code execution happens as
  sandboxed subprocesses in the same container.
- **Database:** MongoDB Atlas.

## Known limitations

- Plagiarism detection uses n-gram similarity rather than a
  winnowing/fingerprinting algorithm like MOSS — effective against
  copy-paste and light edits, less so against heavily restructured code.
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
- The code editor's syntax highlighting is a lightweight custom tokenizer
  (keywords/strings/comments/numbers/brackets), not a full language parser
  — good for readability, not semantically precise on every edge case.

## License

MIT