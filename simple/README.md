# PocketDev Remote Project Manager

A remote management system for Claude Code that enables managing multiple projects through git worktrees, with GitHub integration and IDE connectivity.

## Overview

This system allows you to:
- Manage multiple projects (git repositories) remotely
- Create isolated tasks using git worktrees
- Launch Claude terminal sessions for each task
- Connect JetBrains IDEs to worktrees
- Perform git operations through the web UI

## Architecture

- **Projects = Git Repositories** (1:1 mapping)
- **Tasks = Git Worktrees** (isolated work environments)
- **Single ttyd instance** with URL-based routing
- **GitHub integration** for repository browsing

## Quick Start

```bash
# Using Docker
cd /home/jeffh/projects/pocketdev-simple-server/simple
docker-compose up -d

# Access dashboard
open http://localhost:3005/frontend/project-dashboard-v2.html
```

## Key Features

### Project Management
- Clone repositories from GitHub
- Create isolated tasks (worktrees)
- Launch Claude terminals per task

### GitHub Integration
- Browse all your repositories
- Token persistence
- Branch selection

### Git Operations
- Commit, push, create PRs
- Task-level isolation
- Branch management

### IDE Connectivity
- SSH access for JetBrains
- Remote development support
- See REMOTE-IDE-CONNECTIVITY.md

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design details
- **[REMOTE-PROJECT-MANAGER.md](REMOTE-PROJECT-MANAGER.md)** - Setup guide
- **[REMOTE-IDE-CONNECTIVITY.md](REMOTE-IDE-CONNECTIVITY.md)** - IDE integration
- **[LEARNINGS.md](LEARNINGS.md)** - Implementation lessons

## File Structure

```
simple/
├── project-manager.js         # API server
├── worktree-claude.sh        # ttyd wrapper
├── docker-compose.yml        # Services
├── frontend/
│   ├── project-dashboard-v2.html
│   └── project-page.html
└── projects/                 # Repositories
```

## Cleanup

Remove legacy files:
```bash
./cleanup-legacy-files.sh
```