# Runs the Express API AND executes submitted code directly inside this
# same container as locked-down subprocesses (see services/codeExecutor.js) --
# no Docker-in-Docker, no external sandbox containers, no Docker daemon
# needed at runtime. This lets the whole thing run on a plain free-tier host
# (e.g. Render) that has no Docker socket available.
#
# Submitted code runs as the unprivileged "node" user that ships with this
# base image (reused as the sandbox user below), never as root -- with
# ulimit-based CPU/memory/process caps and a hard `timeout` wrapper on top
# (see codeExecutor.js for details).

FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    openjdk-17-jdk-headless \
    && rm -rf /var/lib/apt/lists/*

# node:20-slim already ships an unprivileged "node" user at uid/gid 1000 --
# reuse it as the sandbox user instead of creating a new one (which collides
# with that existing uid). SANDBOX_UID/SANDBOX_GID in codeExecutor.js default
# to 1000 already, so no other change is needed.

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

EXPOSE 5000
CMD ["node", "server.js"]
