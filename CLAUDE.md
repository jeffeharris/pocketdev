# CLAUDE.md

<!-- Document Metadata
Created: 2025-06-04
Modified: 2025-09-14
Status: active
-->


This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PocketDev is a web-based system for managing AI development teams. It treats AI developers (Claude, Codex, Gemini) like a real development team, where you can assign tasks, monitor progress, and merge their work - essentially turning you into an engineering manager for AI developers.

## 🎯 Design Philosophy: AI-Optimized Architecture

This codebase is designed for **AI-assisted development** - optimizing for clarity and comprehension when working with AI tools like Claude.

### Core Principle
**"One concept, one file, complete implementation"** - AI understands complete modules better than scattered logic.

### Architectural Approach
We use different patterns for different layers:

#### Services & Domain Logic
Use **Ousterhout's deep modules** - simple interface, complex implementation:
- GitService: ~10 public methods hiding git complexity
- TaskService: ~8 methods orchestrating task operations
- Hide implementation details, expose clean APIs

#### Feature Modules  
Use **complete self-contained modules** - all related logic in one file:
- `features/terminal-tabs.ts`: ALL tab logic (466 lines)
- `features/split-view.ts`: ALL split-view logic (556 lines)
- 500-1000 lines is fine if it's complete and cohesive
- Wide interfaces are OK here - transparency helps AI understand

#### UI Components
Use **React patterns** - compound components, hooks:
- Container/presentational separation
- Custom hooks for reusable logic
- Keep components focused on rendering

### Key Insight
**For features**: Complete visibility > theoretical purity. A 500-line file with everything about tabs is better for AI than 10 files with perfect separation.

**For services**: Deep modules with narrow interfaces work well because they hide genuine complexity (git operations, database queries).

### Additional Resources
- **AI Architecture Guide**: `/plan-pocketdev/steering/ai-assisted-architecture.md` - Patterns for AI collaboration
- **Design Guidance**: `/plan-pocketdev/steering/developer-guidance.md` - Architectural principles and patterns
- **Code Examples**: `/plan-pocketdev/steering/module-design-examples.md` - Before/after refactoring examples
- **Tech Choices**: `/plan-pocketdev/steering/tech-choices.md` - Technology decisions and rationale

## Architecture

### Three-Service Architecture
- **Backend** (`/backend`, port 3005): Express API handling project/task management, Git operations, SQLite database
- **Frontend** (`/frontend`, port 5173): React 19 + TypeScript + Vite + TailwindCSS
- **Shelltender** (`/shelltender`, port 8080): Terminal infrastructure for persistent AI sessions (v0.6.2)

### Data Hierarchy
```
Repositories → Projects → Tasks → Terminal Sessions
```

### Service Communication
```
Frontend (React) ←→ Backend API (Express)
     ↓                    ↓
 Shelltender ←────────────┘
 (WebSocket)
```

## 🚨 Critical Patterns & Rules

### No Backward Compatibility (IMPORTANT)
This is a **hobby project** - do NOT add backward compatibility code unless explicitly requested:
- **Remove old code** when refactoring - don't create adapters or wrappers
- **Delete unused parameters** immediately - don't keep them "just in case"
- **Eliminate fake methods** - no stub functions that do nothing
- **Clean breaks are preferred** - this isn't enterprise software
- If the human hasn't asked for backward compatibility, assume they want clean code

### Frontend Import Rules (MUST FOLLOW)
Due to Vite's ES module handling, **always use direct imports**:

```typescript
// ❌ WRONG - Will fail in browser
import { Task, Project } from '../types';

// ✅ CORRECT - Direct file imports
import { Task } from '../types/task';
import { Project } from '../types/project';
```

### Module Design Guidelines

#### For Services (Backend/Domain Logic)
1. **Hide implementation details**: Never expose data structures
2. **Limit public methods**: Maximum 10 per module, prefer 5-7
3. **Single responsibility**: One clear purpose per service
4. **Define errors out of existence**: Design APIs that can't be misused

#### For Feature Modules (Frontend)
1. **Complete implementation**: All related logic in one file
2. **Wide interfaces OK**: Transparency helps AI comprehension
3. **500-1000 lines is fine**: If it's cohesive and complete
4. **Prefer visibility**: Don't hide unless there's real complexity

### Common Anti-Patterns to Avoid
- **God objects**: Classes/components doing too many things
- **Leaky abstractions**: Exposing implementation details
- **Pass-through methods**: Functions that just call other functions
- **Mixed abstraction levels**: Business logic mixed with UI/transport
- **Global state**: Using `app.locals` or similar patterns
- **Backward compatibility layers**: Don't create unless explicitly requested
- **Fake/stub methods**: Remove unused code instead of stubbing it out

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

**Note**: WebSocket event system needs refactoring (see BUG-019) - currently has 10 methods for what should be 1 broadcast operation.

### Security Patterns
- Encrypted credential storage using AES-256-GCM
- Prepared SQL statements (injection prevention)
- Input validation in all controllers
- Docker security mode available with UID/GID mapping

## Development Workflow

### Common Commands
```bash
# Development
make dev        # Start all services with hot reloading
make logs       # View container logs
make shell      # Access backend container

# Testing & Quality
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

### Development Best Practices
1. **Frontend Changes**: Hot reload via Vite, components in `/frontend/src`
2. **Backend Changes**: Nodemon auto-restart, aim for service layer separation
3. **Database Changes**: Update schema in `/backend/db/schema.sql`, add migration files
4. **Create Deep Modules**: When adding features, hide complexity behind simple interfaces

## Current Technical Debt

### High Priority Issues
1. **Missing Service Layer**: Controllers doing business logic (BUG-013)
2. **API Complexity**: 44 methods in single class (BUG-011)
3. **Session ID Chaos**: 3 different ID types for same concept (BUG-017)
4. **Global State**: `app.locals` pattern throughout backend (BUG-014)

### Ongoing Refactoring
- Creating proper service layer architecture
- Reducing interface complexity across all modules
- Implementing dependency injection
- See `/plan-pocketdev/bugs/prioritization.md` for full list

## AI Agent Integration

Supported AI developers and their commands:
- **Claude**: Via Claude Code CLI (auto-installed)
- **Codex**: OpenAI integration
- **Gemini**: Google AI integration
- **Aider**: Multi-model support

Each runs in isolated worktrees with persistent context.

## Testing Notes

### Browser Testing with Playwright
When using Playwright to test the PocketDev frontend:
- **Issue**: Playwright runs in a Docker container on a different network
- **Solution**: Use host machine's IP address instead of localhost
- **Example**: `http://172.27.194.177:5173` (replace with your host's IP)
- To find your host IP: `hostname -I | awk '{print $1}'`

### Shelltender Admin UI
- Access at http://localhost:8080/admin
- Features: session monitoring, bulk operations, resource tracking
- Note: v0.6.2 includes the admin UI HTML file properly

## Contributing Guidelines

### Before Writing Code
1. **Check for existing patterns**: Don't create new patterns without understanding current ones
2. **Design for deep modules**: Simple interface, complex implementation
3. **Consider the abstraction**: Is this the right layer for this logic?
4. **Avoid premature abstraction**: Don't create abstractions for single use cases

### Code Review Checklist
- [ ] Interface has fewer than 10 public methods?
- [ ] Implementation details are hidden?
- [ ] Single responsibility maintained?
- [ ] No pass-through methods?
- [ ] Proper error handling (not just try-catch everywhere)?
- [ ] Frontend imports use direct paths?

## Recent Features & Status

### Split Views Feature ✅ Complete
- View 2 or 4 terminals simultaneously with Alt+D to cycle modes
- Layout persistence across sessions
- Docs: See `/plan-pocketdev/specs/split-views/`

### Multi-Terminal Tabs 🚧 In Progress
- Phase 1 (Backend) Complete
- Phase 2 (Frontend) Needed
- Docs: See `/.pocketdev/specs/multi-terminal-tabs/`

---

Remember: **The goal is to reduce complexity, not just make things work.** Every module should be deeper than it is wide.