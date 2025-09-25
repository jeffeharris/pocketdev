FROM node:22-alpine AS base
RUN apk add --no-cache git openssh-client curl && \
    # Install GitHub CLI
    curl -fsSL https://github.com/cli/cli/releases/download/v2.40.1/gh_2.40.1_linux_amd64.tar.gz | tar -xz && \
    mv gh_2.40.1_linux_amd64/bin/gh /usr/local/bin/ && \
    rm -rf gh_2.40.1_linux_amd64 && \
    chmod +x /usr/local/bin/gh

FROM base AS backend

# The node:22-alpine image has a 'node' user with UID 1000
# We'll rename it to pocketdev to match our naming convention
RUN deluser node && \
    addgroup -g 1000 pocketdev && \
    adduser -D -u 1000 -G pocketdev -s /bin/sh pocketdev

WORKDIR /app

# Copy package files
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy application code
COPY backend/ ./
COPY shared/ ./shared/
COPY backend-entrypoint.sh /entrypoint.sh

# Create necessary directories and set ownership
RUN mkdir -p /projects /app/data /home/pocketdev/.pocketdev && \
    chmod +x /entrypoint.sh && \
    chown -R pocketdev:pocketdev /app /projects /app/data /home/pocketdev

# Switch to pocketdev user
USER pocketdev

EXPOSE 3005

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
