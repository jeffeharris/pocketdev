# AI Developer Container
FROM ubuntu:22.04

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    nodejs \
    npm \
    python3 \
    python3-pip \
    build-essential \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Install Claude CLI
RUN npm install -g @anthropic-ai/claude-code

# Install Codex CLI
RUN npm install -g @openai/codex

# Install common development tools
RUN npm install -g \
    typescript \
    @types/node \
    jest \
    mocha \
    eslint \
    prettier

# Python test tools
RUN pip3 install pytest black flake8

# Create workspace
WORKDIR /workspace

# Add git configuration
RUN git config --global user.email "ai-developer@pocketdev.local" && \
    git config --global user.name "AI Developer"

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]