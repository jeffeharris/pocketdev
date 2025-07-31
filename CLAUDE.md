# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PocketDev is a web-based system for managing AI development teams. It treats AI developers (Claude, Codex, Gemini) like a real development team, where you can assign tasks, monitor progress, and merge their work - essentially turning you into an engineering manager for AI developers.

## Recently Completed Features

### Split Views Feature (Completed)
- **Status**: Phase 1 (2-way splits) and Phase 2 (quad view) Complete
- **Branch**: `feature/split-views` (merged to dev)
- **Docs**: See `plan-pocketdev/specs/split-views/` for requirements and implementation
- View 2 or 4 terminals simultaneously with Alt+D to cycle modes
- Layout persistence across sessions (REQ-SV-019a implemented)
- Enable with `VITE_FEATURE_SPLIT_VIEW=true`

### Multi-Terminal Tabs Feature (In Progress)
- **Status**: Phase 1 (Backend) Complete, Phase 2 (Frontend) Needed
- **Branch**: `feature/multi-terminal-tabs`
- **Docs**: See `.pocketdev/specs/multi-terminal-tabs/` for requirements and design
- **Handoff**: If continuing this work, start with `handoff-phase1-complete.md`

## Architecture

### Three-Service Architecture
- **Backend** (`/backend`, port 3005): Express API handling project/task management, Git operations, SQLite database
- **Frontend** (`/frontend`, port 5173): React 19 + TypeScript + Vite + TailwindCSS
- **Shelltender** (`/shelltender`, port 8080): Terminal infrastructure for persistent AI sessions (v0.6.2 with admin UI)

### Data Hierarchy
```
Repositories → Projects → Tasks → Terminal Sessions
```

## Common Development Commands

```bash
# Development
make dev        # Start all services with hot reloading
make logs       # View container logs
make shell      # Access backend container
make build-all  # Build all Docker images

# Testing & Linting
cd backend && npm test          # Run backend tests
cd frontend && npm run lint     # Lint frontend
cd frontend && npm run type-check  # TypeScript checking

# Database
make db-backup  # Backup SQLite database
make db-shell   # SQLite console

# Git Operations (inside task)
git status
git add -A && git commit -m "message"
git push origin branch-name
gh pr create --title "title" --body "description"
```

## Key Technical Patterns

### Git Worktree Management
Each task operates in an isolated git worktree:
- Non-destructive merge conflict detection using `git merge-tree`
- Automatic cleanup of orphaned worktrees
- Quick branch switching without affecting other tasks
- Worktree paths: `/projects/{project-id}/worktrees/{task-id}`

### AI Session State Tracking
The system monitors AI state through terminal output patterns:
- States: `not-started`, `idle`, `working`, `waiting`
- Claude thinking pattern detection (e.g., "✻ Analyzing...")
- Real-time WebSocket broadcasting of state changes
- Session persistence in `/app/data/shelltender-sessions`

### Shelltender Admin UI
- Access at http://localhost:8080/admin
- Features: session monitoring, bulk operations, resource tracking
- Note: v0.6.2 includes the admin UI HTML file properly

### Frontend Import Rules
**CRITICAL**: Due to Vite's ES module handling, always use direct imports:

```typescript
// ❌ WRONG - Will fail in browser
import { Task, Project } from '../types';

// ✅ CORRECT - Direct file imports
import { Task } from '../types/task';
import { Project } from '../types/project';
```

### Database Schema
Key tables and their relationships:
- `projects`: Git repositories with metadata
- `tasks`: Worktree-based isolated environments (foreign key to projects)
- `terminal_sessions`: AI work sessions with analytics (foreign key to tasks)
- `git_credentials`: Encrypted token storage
- `worktree_registry`: Orphan detection system

### WebSocket Events
Backend broadcasts these events for real-time updates:
- `task-created`, `task-updated`, `task-deleted`
- `terminal-state-changed`
- `ai-state-changed`
- `merge-status-changed`

### Security Patterns
- Encrypted credential storage using AES-256-GCM
- Prepared SQL statements (injection prevention)
- Input validation in all controllers
- Docker security mode available with UID/GID mapping

## Service Communication

```
Frontend (React) ←→ Backend API (Express)
     ↓                    ↓
 Shelltender ←────────────┘
 (WebSocket)
```

Backend coordinates between frontend requests and Shelltender terminal sessions, maintaining state in SQLite.

## Development Workflow

1. **Frontend Changes**: Hot reload via Vite, components in `/frontend/src`
2. **Backend Changes**: Nodemon auto-restart, modular architecture in `/backend`
3. **Database Changes**: Update schema in `/backend/db/schema.sql`, migrations in `/backend/db/migrations`
4. **Docker Changes**: Service Dockerfiles in their directories, compose files at root

## AI Agent Integration

Supported AI developers and their commands:
- **Claude**: Via Claude Code CLI (auto-installed)
- **Codex**: OpenAI integration
- **Gemini**: Google AI integration
- **Aider**: Multi-model support

Each runs in isolated worktrees with persistent context.

## Browser Testing with Playwright

When using Playwright to test the PocketDev frontend:
- **Issue**: Playwright runs in a Docker container on a different network than the PocketDev services
- **Solution**: Access the frontend using the host machine's IP address instead of localhost
- **Example**: `http://172.27.194.177:5173` (replace with your host's IP)
- To find your host IP: `hostname -I | awk '{print $1}'`
- Note: Using `localhost`, `127.0.0.1`, or Docker container names won't work due to network isolation