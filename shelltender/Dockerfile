FROM pocketdev/ai-base:latest

# Switch to root for package installation
USER root

# Only need to ensure build tools for node-pty
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY shelltender/package*.json ./

# Install dependencies (this will compile node-pty for the container architecture)
RUN npm ci --include=dev && \
    npm rebuild node-pty --update-binary

# Copy application code
COPY shelltender/ ./

# Copy system-wide bash configuration
COPY shelltender/bash-config/bash.bashrc /etc/bash.bashrc

# Copy user-specific bashrc files to ensure both users source the system config
COPY shelltender/bash-config/pocketdev.bashrc /home/pocketdev/.bashrc
COPY shelltender/bash-config/root.bashrc /root/.bashrc
RUN chown pocketdev:pocketdev /home/pocketdev/.bashrc

# Ensure proper permissions
RUN chmod +x shelltender-service.js || true

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

EXPOSE 8080

# Ensure proper ownership for the pocketdev user
RUN chown -R pocketdev:pocketdev /app

# Create sessions directory and data directory
RUN mkdir -p /app/.sessions && chmod 777 /app/.sessions && \
    mkdir -p /app/data/shelltender-sessions && chmod 777 /app/data/shelltender-sessions

# Run as pocketdev user
USER pocketdev

CMD ["node", "shelltender-service.js"]
