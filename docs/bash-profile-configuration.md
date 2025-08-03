# Bash Profile Configuration Architecture

This document explains how bash profiles and shell configuration work in PocketDev after the centralization cleanup.

## Overview

PocketDev uses a centralized bash configuration approach where all shell customization is handled through a single system-wide configuration file that works for both root and pocketdev users.

## Configuration Flow

### 1. Build Time (Docker Images)

```
Dockerfile.ai-base
    ↓
Sets git safe.directory for both users:
- root: git config --global --add safe.directory '*'
- pocketdev: su - pocketdev -c "git config --global --add safe.directory '*'"
```

### 2. Container Build (Shelltender)

```
shelltender/Dockerfile
    ↓
Copies configuration files:
- /etc/bash.bashrc (system-wide config)
- /home/pocketdev/.bashrc (sources system config)
- /root/.bashrc (sources system config)
```

### 3. Runtime (Terminal Creation)

```
Backend (terminal.service.js)
    ↓
Creates session with environment variables:
- TASK_ID, TASK_NAME
- WORKTREE_PATH, PROJECT_NAME
- GIT_USER_NAME, GIT_USER_EMAIL
- HISTFILE (for persistent history)
    ↓
Shelltender
    ↓
Spawns: /bin/bash --login -i
    ↓
Bash loads in order:
1. /etc/profile (system defaults)
2. /etc/bash.bashrc (PocketDev config)
3. ~/.bashrc (sources /etc/bash.bashrc)
```

## File Locations and Purpose

### Core Configuration Files

- **`/etc/bash.bashrc`**: Main configuration file containing:
  - Smart prompt with git branch info
  - Task context display
  - Directory change tracking
  - Git aliases (gs, ga, gc, etc.)
  - History configuration
  - Git user config from env vars
  - Welcome message for PocketDev terminals

- **`/home/pocketdev/.bashrc`**: Simple file that sources `/etc/bash.bashrc`
- **`/root/.bashrc`**: Simple file that sources `/etc/bash.bashrc`

### Removed Files (No Longer Used)

- ~~`/scripts/pocketdev-shell.sh`~~ - Would bypass profiles with --norc
- ~~`/backend/config/default-bashrc`~~ - Duplicate configuration
- ~~`/backend/docker/bash-config/`~~ - Old configuration directory

## Key Features

### Smart Prompt System

The prompt shows contextual information when you:
- Change directories
- Run commands that produce lots of output (npm, docker, make)
- Explicitly request context with the `context` command or `where` alias

Format: `⎇ branch-name | task-name | ~/relative/path`

### Git Configuration

Git user configuration is handled automatically:
1. Backend reads from settings database
2. Passes as GIT_USER_NAME and GIT_USER_EMAIL env vars
3. bash.bashrc sets git config if not already set

### Command Enhancements

Wrapped commands that trigger context display:
- `claude` - Shows context after AI interactions
- `npm install/test/build` - Shows context after npm operations
- `docker logs/build` - Shows context after docker operations
- `make` - Shows context after make commands
- `clear` - Shows context after clearing screen

## Environment Variables

Variables passed from backend to each terminal session:

| Variable | Purpose | Example |
|----------|---------|---------|
| TASK_ID | Unique task identifier | task_abc123 |
| TASK_NAME | Human-readable task name | "Fix login bug" |
| WORKTREE_PATH | Git worktree location | /projects/repo/worktrees/task_abc123 |
| PROJECT_NAME | Project name | "my-app" |
| GIT_USER_NAME | Git commit author | "John Doe" |
| GIT_USER_EMAIL | Git commit email | "john@example.com" |
| HISTFILE | Persistent history location | /app/data/.../history |
| DB_SESSION_ID | Database session ID | 123 |

## Design Principles

1. **Single Source of Truth**: All bash configuration in `/etc/bash.bashrc`
2. **User Parity**: Root and pocketdev get identical shell features
3. **Environment-Driven**: Configuration via env vars, not file edits
4. **Non-Intrusive**: Git config only set if not already configured
5. **Context-Aware**: Smart prompts that appear when needed

## Testing Configuration

To verify the configuration is working:

```bash
# Check if both users source the system config
docker exec -it shelltender-container bash -c "grep bash.bashrc /root/.bashrc"
docker exec -it shelltender-container bash -c "grep bash.bashrc /home/pocketdev/.bashrc"

# Verify git safe.directory is set
docker exec -it shelltender-container git config --global --get-all safe.directory
docker exec -u pocketdev shelltender-container git config --global --get-all safe.directory

# Test prompt features
docker exec -it shelltender-container bash -ilc "cd /tmp && pwd"
```

## Troubleshooting

### Issue: Git "dubious ownership" errors
**Solution**: Already handled by setting `safe.directory '*'` for both users in Dockerfile.ai-base

### Issue: Root user doesn't get custom prompt
**Solution**: Root now has `/root/.bashrc` that sources the system config

### Issue: Git config not being set
**Check**: Ensure GIT_USER_NAME and GIT_USER_EMAIL env vars are passed from backend

### Issue: History not persisting
**Check**: Verify HISTFILE env var points to a writable location