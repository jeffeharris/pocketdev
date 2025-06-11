# PocketDev Remote Project Manager

A remote management system for Claude Code that enables managing multiple projects through git worktrees, with GitHub integration, IDE connectivity, and SQLite persistence.

## Overview

This system allows you to:
- Manage multiple projects (git repositories) remotely with persistent storage
- Create isolated tasks using git worktrees
- Launch Claude terminal sessions for each task with session analytics
- Connect JetBrains IDEs to worktrees
- Perform git operations through the web UI
- Track Claude session usage and costs
- Clean up orphaned worktrees automatically

## Architecture

- **Projects = Git Repositories** (1:1 mapping)
- **Tasks = Git Worktrees** (isolated work environments)
- **Single ttyd instance** with URL-based routing
- **GitHub integration** for repository browsing
- **SQLite database** for persistent storage of projects, tasks, and sessions
- **Session analytics** tracking token usage, tool usage, and costs

## Quick Start

```bash
# Using Docker with SQLite persistence
cd /home/jeffh/projects/pocketdev-simple-server/simple
docker-compose up -d

# Or using the database-backed server directly
./start-db.sh

# Access dashboard
open http://localhost:3005/frontend/project-dashboard-v2.html
```

The SQLite database will be created at `simple/data/pocketdev.db` and all projects, tasks, and sessions will persist across server restarts.

## Key Features

### Project Management
- Clone repositories from GitHub with persistent tracking
- Create isolated tasks (worktrees) with automatic cleanup
- Launch Claude terminals per task with session persistence
- All data stored in SQLite database

### GitHub Integration
- Browse all your repositories
- Token persistence in database
- Branch selection and management

### Git Operations
- Commit, push, create PRs
- Task-level isolation
- Branch management
- Automatic detection of uncommitted changes

### IDE Connectivity
- SSH access for JetBrains
- Remote development support
- See REMOTE-IDE-CONNECTIVITY.md

### Session Analytics & Tracking
- Track Claude session usage per task
- Monitor token usage and costs
- Tool usage statistics
- Session history and analytics

### Cleanup & Maintenance
- Automatic detection of orphaned worktrees
- Safe cleanup with archive options
- Database-backed worktree registry

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design details
- **[REMOTE-PROJECT-MANAGER.md](REMOTE-PROJECT-MANAGER.md)** - Setup guide
- **[REMOTE-IDE-CONNECTIVITY.md](REMOTE-IDE-CONNECTIVITY.md)** - IDE integration
- **[LEARNINGS.md](LEARNINGS.md)** - Implementation lessons

## File Structure

```
simple/
├── server/
│   ├── project-manager-db.cjs   # Database-backed API server
│   ├── db/                      # Database layer
│   │   ├── index.cjs           # Database connection
│   │   ├── schema.sql          # SQLite schema
│   │   └── models/             # Data models
│   │       ├── project.cjs
│   │       ├── task.cjs
│   │       └── session.cjs
│   └── server.js               # Legacy server
├── data/
│   └── pocketdev.db            # SQLite database
├── worktree-claude.sh          # ttyd wrapper
├── docker-compose.yml          # Services
├── start-db.sh                 # Database server startup
├── frontend/
│   ├── project-dashboard-v2.html
│   └── project-page.html
└── projects/                   # Git repositories & worktrees
```

## Cleanup

Remove legacy files:
```bash
./cleanup-legacy-files.sh
```