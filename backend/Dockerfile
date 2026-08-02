# Runs the Express API itself in a container. It also needs to be able to
# launch sibling "code-runner" containers to judge submissions (see
# services/codeExecutor.js), so this image includes the `docker` CLI. The
# actual Docker daemon it talks to is the HOST's daemon, reached by mounting
# /var/run/docker.sock into this container at runtime (see docker-compose.yml
# at the project root). This is the standard "Docker-outside-of-Docker"
# pattern -- no Docker daemon is installed inside this image.

FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg && \
    install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
    chmod a+r /etc/apt/keyrings/docker.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list && \
    apt-get update && apt-get install -y --no-install-recommends docker-ce-cli && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

EXPOSE 5000
CMD ["node", "server.js"]
