FROM node:22

# Install build dependencies for node-pty
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY shelltender/package*.json ./

# Install dependencies (this will compile node-pty for the container architecture)
RUN npm ci --include=dev && \
    npm rebuild node-pty --update-binary

# Copy application code
COPY shelltender/ ./

# Ensure proper permissions
RUN chmod +x shelltender-service.js || true

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

EXPOSE 8080

# Ensure proper ownership for the existing node user
RUN chown -R node:node /app

# Create sessions directory and data directory
RUN mkdir -p /app/.sessions && chmod 777 /app/.sessions && \
    mkdir -p /app/data/shelltender-sessions && chmod 777 /app/data/shelltender-sessions

# Run as non-root user
# USER node  # Temporarily disabled to debug segfault

CMD ["node", "shelltender-service.js"]
