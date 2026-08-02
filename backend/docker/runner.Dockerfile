# Sandbox image the backend spawns (via `docker run`) once per test case to
# execute untrusted user code in isolation. It is intentionally NOT the same
# image as the backend API -- it has no access to the database, the network
# (the backend runs it with --network none), or anything outside the one
# temp directory bind-mounted in as /box.
#
# Build once with:
#   docker build -t oj-code-runner:latest -f backend/docker/runner.Dockerfile backend/docker

FROM ubuntu:22.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    g++ \
    openjdk-17-jdk-headless \
    nodejs \
    coreutils \
    && rm -rf /var/lib/apt/lists/*

# Run as a non-root, unprivileged user inside the container
RUN useradd -m -u 1000 sandbox
USER sandbox
WORKDIR /box
