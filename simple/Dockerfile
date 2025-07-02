FROM node:20-slim

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

# Create pocketdev user early
RUN useradd -m -s /bin/bash pocketdev && \
    mkdir -p /home/pocketdev/.npm-global && \
    chown -R pocketdev:pocketdev /home/pocketdev

# Configure npm to use pocketdev's global directory
ENV NPM_CONFIG_PREFIX=/home/pocketdev/.npm-global
ENV PATH=$NPM_CONFIG_PREFIX/bin:$PATH

# Switch to pocketdev user to install Claude
USER pocketdev
RUN npm install -g @anthropic-ai/claude-code

# Switch back to root for directory creation
USER root

# Create workspace directory with proper permissions
RUN mkdir -p /workspace /tmp/pocketdev-worktrees && \
    chown -R pocketdev:pocketdev /workspace /tmp/pocketdev-worktrees

# Setup server
WORKDIR /app
RUN chown -R pocketdev:pocketdev /app

# Switch to pocketdev user for npm install
USER pocketdev
COPY --chown=pocketdev:pocketdev server/package*.json ./
RUN npm install

# Switch back to root for copying files
USER root

# Copy the new modular structure
COPY --chown=pocketdev:pocketdev server/*.js ./
COPY --chown=pocketdev:pocketdev server/config ./config
COPY --chown=pocketdev:pocketdev server/controllers ./controllers
COPY --chown=pocketdev:pocketdev server/services ./services
COPY --chown=pocketdev:pocketdev server/routes ./routes
COPY --chown=pocketdev:pocketdev server/middleware ./middleware
COPY --chown=pocketdev:pocketdev server/db ./db

# Configure git for both root and pocketdev
RUN git config --global user.email "claude@pocketdev.ai" && \
    git config --global user.name "Claude"

# Configure git for pocketdev user
USER pocketdev
RUN git config --global user.email "claude@pocketdev.ai" && \
    git config --global user.name "Claude"

# Stay as pocketdev user

EXPOSE 3001

CMD ["npm", "start"]