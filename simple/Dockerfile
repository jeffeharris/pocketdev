FROM node:22-slim

# Install git, network tools, debugging utilities, build tools for node-pty, and locales
RUN apt-get update && apt-get install -y \
    git \
    netstat-nat \
    net-tools \
    iproute2 \
    strace \
    procps \
    curl \
    psmisc \
    lsof \
    python3 \
    make \
    g++ \
    locales \
    && sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen \
    && locale-gen \
    && update-locale LANG=en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

# Set locale environment variables
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8
ENV LC_CTYPE=en_US.UTF-8
RUN npm install -g @anthropic-ai/claude-code

# Create workspace directory with proper permissions
# Note: node user already exists in node:20-slim image
RUN mkdir -p /workspace /tmp/pocketdev-worktrees && \
    chown -R node:node /workspace /tmp/pocketdev-worktrees

# Setup server
WORKDIR /app
COPY server/package*.json ./
# Clean install to ensure native modules are built correctly
RUN npm ci --only=production || npm install --production
COPY server/*.js server/*.cjs ./

# Configure git
RUN git config --global user.email "claude@pocketdev.ai" && \
    git config --global user.name "Claude"

# Set ownership of app directory to node user
RUN chown -R node:node /app

# Switch to non-root user
USER node

EXPOSE 3001

CMD ["npm", "start"]