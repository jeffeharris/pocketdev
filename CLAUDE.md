# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PocketDev is a web-based system for managing AI development teams. It treats AI developers (Claude, Codex, Gemini) like a real development team, where you can assign tasks, monitor progress, and merge their work - essentially turning you into an engineering manager for AI developers.

## Architecture

### Three-Service Architecture
- **Backend** (`/backend`, port 3005): Express API handling project/task management, Git operations, SQLite database
- **Frontend** (`/frontend`, port 5173): React 19 + TypeScript + Vite + TailwindCSS
- **Shelltender** (`/shelltender`, port 8080): Terminal infrastructure for persistent AI sessions

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