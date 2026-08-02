# Runs the Express API AND executes submitted code directly inside this
# same container as locked-down subprocesses (see services/codeExecutor.js) --
# no Docker-in-Docker, no external sandbox containers, no Docker daemon
# needed at runtime. This lets the whole thing run on a plain free-tier host
# (e.g. Render) that has no Docker socket available.
#
# Submitted code runs as the unprivileged "sandbox" user created below, never
# as the same user running the Express server, with ulimit-based CPU/memory/
# process caps and a hard `timeout` wrapper (see codeExecutor.js for details).

FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    openjdk-17-jdk-headless \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 1000 -s /usr/sbin/nologin sandbox

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

EXPOSE 5000
CMD ["node", "server.js"]