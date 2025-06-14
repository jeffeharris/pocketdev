FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    python3 \
    python3-pip \
    nodejs \
    npm \
    build-essential \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Create claude user
RUN useradd -m -s /bin/bash claude && \
    echo "claude ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Install global npm packages
RUN npm install -g typescript @types/node

# Switch to claude user
USER claude
WORKDIR /home/claude

# Install Claude Code
# Note: You'll need to install Claude Code here
# For now, we'll create a placeholder script
RUN mkdir -p /home/claude/.local/bin
ENV PATH="/home/claude/.local/bin:${PATH}"

# Create a wrapper script for Claude Code
RUN echo '#!/bin/bash\n\
if [ -z "$ANTHROPIC_API_KEY" ]; then\n\
    echo "Error: ANTHROPIC_API_KEY not set"\n\
    exit 1\n\
fi\n\
\n\
# Check if claude command exists\n\
if command -v claude &> /dev/null; then\n\
    claude "$@"\n\
else\n\
    echo "Claude Code not installed. Please install it first."\n\
    echo "Visit: https://claude.ai/code"\n\
fi' > /home/claude/.local/bin/claude-wrapper && \
    chmod +x /home/claude/.local/bin/claude-wrapper

# Set up workspace
WORKDIR /workspace

# Entry point
CMD ["/bin/bash"]