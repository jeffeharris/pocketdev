# PocketDev Remote Project Manager

A remote management system for Claude Code that enables managing multiple projects through git worktrees, with GitHub integration, IDE connectivity, and SQLite persistence.

## Overview

This system allows you to:
- Manage multiple projects (git repositories) remotely with persistent storage
- Create isolated tasks using git worktrees
- Launch Claude terminal sessions for each task with session analytics
- **NEW: Create multiple terminal tabs per task (up to 6 concurrent AI sessions)**
- **NEW: Auto-launch Claude in new tabs with one click**
- Connect JetBrains IDEs to worktrees
- Perform git operations through the web UI
- Track Claude session usage and costs
- Clean up orphaned worktrees automatically
- Monitor AI session states and patterns with Shelltender integration

## Architecture

- **Projects = Git Repositories** (1:1 mapping)
- **Tasks = Git Worktrees** (isolated work environments)
- **Shelltender integration** for terminal session management
- **GitHub integration** for repository browsing
- **SQLite database** for persistent storage of projects, tasks, and sessions
- **Session analytics** tracking token usage, tool usage, and costs
- **AI monitoring** for Claude thinking patterns and session states

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

- **Backend**: Node.js with Express (ES modules) - Modular architecture
- **Database**: SQLite with prepared statements
- **Frontend**: Vanilla JavaScript with modern ES6+
- **Terminal**: Shelltender v0.6.2 for web-based terminal access with AI monitoring
- **Container**: Docker with Docker Compose
- **Git**: Requires Git 2.38+ for merge conflict detection

## Server Architecture (New Modular Design)

The server has been refactored from a monolithic 2000+ line file into a clean modular architecture:

```
simple/server/
├── server.js                    # Server initialization & startup
├── app.js                       # Express app configuration
├── config/
│   └── index.js                # Centralized configuration
├── controllers/                 # HTTP request handlers
│   ├── project.controller.js   # Project CRUD operations
│   ├── task.controller.js      # Task management
│   ├── settings.controller.js  # Settings & GitHub token
│   ├── monitoring.controller.js # AI monitoring endpoints
│   ├── terminal.controller.js  # Terminal session management
│   └── upload.controller.js    # File upload handling
├── services/                    # Business logic layer
│   ├── git.service.js          # Git operations
│   ├── cleanup.service.js      # Orphaned resource cleanup
│   ├── merge.service.js        # Merge/rebase operations
│   └── worktree.service.js     # Git worktree management
├── routes/                      # API route definitions
│   ├── index.js                # Route aggregator
│   ├── project.routes.js       # /api/projects
│   ├── task.routes.js          # /api/projects/:id/tasks
│   └── ...                     # Other route modules
├── middleware/                  # Express middleware
│   ├── error.middleware.js     # Error handling
│   └── upload.middleware.js    # File upload config
└── db/                         # Database layer
    ├── index.js                # Database connection
    ├── schema.sql              # SQLite schema
    └── models/                 # Data models
        ├── project.js
        ├── task.js
        └── session.js
```

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
- **Non-destructive merge conflict detection**
  - Uses `git merge-tree --write-tree` for fast conflict checking
  - Working tree is never modified during status checks
  - Temporary worktrees for detailed conflict analysis
  - No stashing operations that could corrupt worktrees

### AI Session Monitoring
- Real-time Claude thinking pattern detection
- Session state tracking (not-started, idle, working, waiting)
- Individual WebSocket connections per task session (Shelltender v0.6.1)
- Pattern-based state detection for AI activities
- WebSocket broadcasting of state changes to frontend

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

### Multi-Terminal Tabs
- Create up to 6 concurrent terminal sessions per task
- Each tab runs an independent AI session with its own context
- Real-time AI state indicators (idle, working, waiting)
- Auto-launch Claude in new tabs with configurable delay
- Tab persistence across page reloads
- WebSocket-based command execution via Shelltender v0.6.2
- Individual session tracking and analytics per tab

### Split Views (NEW)
- View 2 terminal sessions side-by-side within a single task
- Toggle between traditional tab view and new split view mode
- Horizontal and vertical split orientations
- Draggable resizer to adjust pane sizes (10%-90% range)
- Terminal selector dropdowns to choose which terminals to display
- Swap terminals button for quick pane switching
- Layout persistence - split configurations save to database
- Real-time sync - layout changes broadcast to all connected clients
- Mobile responsive - automatically disables on screens <768px
- Visual focus indicators - blue ring for active terminal
- Terminal disposal system prevents memory leaks
- Centralized state management with terminalStore
- Enable via `VITE_FEATURE_SPLIT_VIEW=true` environment variable

### File Attachments
- Upload files directly to task workspaces
- Support for images, documents, code files, config files, and archives
- Drag & drop, clipboard paste, and file browser upload
- File size limit: 10MB per file
- Storage limit: 100MB per task, max 50 files
- Files stored in `.pocketdev/attachments/` within task worktree
- Copy file reference paths for easy use in AI conversations

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `DELETE /api/projects/:id` - Delete project

### Tasks
- `GET /api/projects/:projectId/tasks` - List tasks for project
- `POST /api/projects/:projectId/tasks` - Create new task
- `GET /api/projects/:projectId/tasks/:taskId` - Get task details
- `POST /api/projects/:projectId/tasks/:taskId/git` - Git operations
- `DELETE /api/projects/:projectId/tasks/:taskId` - Delete task
- `GET /api/projects/:projectId/tasks/:taskId/split-layout` - Get split view layout
- `PUT /api/projects/:projectId/tasks/:taskId/split-layout` - Update split view layout

### Settings & Monitoring
- `GET /api/settings` - Get settings
- `PUT /api/settings` - Update settings (GitHub token)
- `GET /api/monitoring/status` - AI monitoring status
- `GET /api/monitoring/notifications` - Get notifications

### Terminal Sessions
- `GET /api/sessions` - List all terminal sessions
- `POST /api/projects/:projectId/tasks/:taskId/terminal` - Create terminal session
- `GET /api/projects/:projectId/tasks/:taskId/terminals` - List terminals for task
- `POST /api/sessions/:sessionId/execute` - Execute command in session (WebSocket-based)

### File Uploads
- `POST /api/projects/:projectId/tasks/:taskId/upload` - Upload file to task
- `GET /api/projects/:projectId/tasks/:taskId/images` - List uploaded files
- `GET /api/projects/:projectId/tasks/:taskId/images/:filename` - Get file
- `DELETE /api/projects/:projectId/tasks/:taskId/images/:filename` - Delete file

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design details
- **[docs/server-architecture.md](docs/server-architecture.md)** - New modular server architecture
- **[REMOTE-PROJECT-MANAGER.md](REMOTE-PROJECT-MANAGER.md)** - Setup guide
- **[REMOTE-IDE-CONNECTIVITY.md](REMOTE-IDE-CONNECTIVITY.md)** - IDE integration
- **[LEARNINGS.md](LEARNINGS.md)** - Implementation lessons

## Cleanup

Remove legacy files:
```bash
./cleanup-legacy-files.sh
```

## Development

```bash
# Run in development mode with hot reloading
cd simple/
npm run dev

# Run tests
npm test

# Build for production
docker-compose build
```

## Debugging Tools

PocketDev includes terminal debugging tools for troubleshooting WebSocket and buffer restoration issues:

- **Terminal Buffer Test** (`/test/terminal-buffer`) - Test terminal buffer restoration with debug logging
- **Raw WebSocket Test** (`/test/terminal-raw`) - Low-level WebSocket testing bypassing the client library
- **Debug Terminal Component** - Swap DirectTerminal with DirectTerminalDebug for verbose logging

See [docs/terminal-debugging.md](docs/terminal-debugging.md) for detailed usage instructions.