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
cd simple/
docker-compose up -d

# Access the project dashboard
open http://localhost:3005/projects.html

# View logs
docker-compose logs -f project-manager
```

The SQLite database will be created at `simple/data/pocketdev.db` and all projects, tasks, and sessions will persist across server restarts.

## Technology Stack

- **Backend**: Node.js with Express (ES modules)
- **Database**: SQLite with prepared statements
- **Frontend**: Vanilla JavaScript with modern ES6+
- **Terminal**: ttyd for web-based terminal access
- **Container**: Docker with Docker Compose

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

### Mobile UI Support
- Fully responsive design for mobile devices
- Collapsible sidebar with hamburger menu navigation
- Touch-friendly controls with 44px minimum touch targets
- Native fullscreen API support for terminal viewing
- Optimized for iPhone and other mobile browsers

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design details
- **[REMOTE-PROJECT-MANAGER.md](REMOTE-PROJECT-MANAGER.md)** - Setup guide
- **[REMOTE-IDE-CONNECTIVITY.md](REMOTE-IDE-CONNECTIVITY.md)** - IDE integration
- **[LEARNINGS.md](LEARNINGS.md)** - Implementation lessons

## File Structure

```
simple/
├── server/
│   ├── project-manager-db.js    # Database-backed API server (ES modules)
│   ├── db/                      # Database layer (ES modules)
│   │   ├── index.js            # Database connection
│   │   ├── schema.sql          # SQLite schema
│   │   └── models/             # Data models
│   │       ├── project.js
│   │       ├── task.js
│   │       └── session.js
│   └── github.js               # GitHub API integration
├── data/
│   └── pocketdev.db            # SQLite database
├── worktree-claude.sh          # ttyd wrapper
├── docker-compose.yml          # Services
├── frontend/
│   ├── projects.html           # Main project dashboard
│   ├── project-page.html       # Individual project view
│   └── cleanup-manager.html    # Orphaned worktree cleanup
└── projects/                   # Git repositories & worktrees
```

## Cleanup

Remove legacy files:
```bash
./cleanup-legacy-files.sh
```