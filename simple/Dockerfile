FROM node:20-slim

# Install git, network tools, and debugging utilities
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
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g @anthropic-ai/claude-code

# Create workspace directory
RUN mkdir -p /workspace /tmp/pocketdev-worktrees

# Setup server
WORKDIR /app
COPY server/package*.json ./
RUN npm install
COPY server/*.js ./

# Configure git
RUN git config --global user.email "claude@pocketdev.ai" && \
    git config --global user.name "Claude"

EXPOSE 3001

CMD ["npm", "start"]