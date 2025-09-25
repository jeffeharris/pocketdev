# PocketDev - GitHub Copilot Instructions

This file provides specific guidance to GitHub Copilot for working effectively with the PocketDev codebase.

## Project Overview

PocketDev is a web-based system for managing AI development teams. It treats AI developers (Claude, Codex, Gemini) like a real development team, where you can assign tasks, monitor progress, and merge their work - essentially turning you into an engineering manager for AI developers.

## Architecture

### Three-Service Architecture
- **Backend** (`/backend`, port 3005): Express API handling project/task management, Git operations, SQLite database
- **Frontend** (`/frontend`, port 5173): React 19 + TypeScript + Vite + TailwindCSS  
- **Shelltender** (`/shelltender`, port 8080): Terminal infrastructure for persistent AI sessions (v0.6.1 with admin UI)

### Data Hierarchy
```
Repositories → Projects → Tasks → Terminal Sessions
```

## Key Technologies

- **Backend**: Node.js with Express (ES modules), SQLite database
- **Frontend**: React 19, TypeScript, Vite, TailwindCSS
- **Containerization**: Docker with Docker Compose
- **Git**: Git worktrees for task isolation, requires Git 2.38+
- **WebSockets**: Real-time communication between services
- **Terminal**: Shelltender for web-based terminal access with AI monitoring

## Coding Conventions

### JavaScript/TypeScript
- Use ES modules (`import`/`export`) consistently
- Use `async/await` for asynchronous operations
- Prefer `const` over `let`, avoid `var`
- Use template literals for string interpolation
- Use destructuring for object/array access
- Follow camelCase for variables and functions
- Use PascalCase for React components

### Frontend Specific (React + TypeScript)
- **CRITICAL**: Always use direct imports due to Vite's ES module handling:
  ```typescript
  // ❌ WRONG - Will fail in browser
  import { Task, Project } from '../types';
  
  // ✅ CORRECT - Direct file imports
  import { Task } from '../types/task';
  import { Project } from '../types/project';
  ```
- Use TypeScript interfaces for type definitions
- Prefer functional components with hooks
- Use React 19 features appropriately
- Component files should be PascalCase (e.g., `TaskView.tsx`)

### Backend Specific (Node.js + Express)
- Use modular architecture with separate controllers, models, services
- Use prepared SQL statements to prevent injection attacks
- Implement proper error handling with try/catch blocks
- Use middleware for cross-cutting concerns (auth, logging, etc.)
- Follow RESTful API conventions

### Database (SQLite)
- Use prepared statements for all queries
- Implement proper transaction handling for complex operations
- Use foreign key constraints to maintain data integrity
- Index frequently queried columns for performance

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

## Development Workflow

### Common Commands
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
```

### Service Development
1. **Frontend Changes**: Hot reload via Vite, components in `/frontend/src`
2. **Backend Changes**: Nodemon auto-restart, modular architecture in `/backend`
3. **Database Changes**: Update schema in `/backend/db/schema.sql`, migrations in `/backend/db/migrations`
4. **Docker Changes**: Service Dockerfiles in their directories, compose files at root

## File Structure Guidelines

### Backend Structure
```
backend/
├── controllers/     # Route handlers
├── models/         # Data models
├── services/       # Business logic
├── db/             # Database schema and migrations
├── middleware/     # Express middleware
└── utils/          # Utility functions
```

### Frontend Structure
```
frontend/src/
├── components/     # Reusable UI components
├── pages/         # Page components
├── types/         # TypeScript type definitions
├── hooks/         # Custom React hooks
├── utils/         # Utility functions
└── styles/        # CSS/styling files
```

## Testing Guidelines

### Backend Testing
- Use the existing test structure in `/server/__tests__/`
- Write unit tests for models, controllers, and services
- Use CommonJS format for test files (`.test.cjs`)
- Mock external dependencies (database, file system, etc.)

### Frontend Testing
- Test React components with appropriate testing libraries
- Write integration tests for user workflows
- Test TypeScript types and interfaces

## Database Schema

Key tables and their relationships:
- `projects`: Git repositories with metadata
- `tasks`: Worktree-based isolated environments (foreign key to projects)
- `terminal_sessions`: AI work sessions with analytics (foreign key to tasks)
- `git_credentials`: Encrypted token storage
- `worktree_registry`: Orphan detection system

## Error Handling

### Backend Error Patterns
```javascript
// Controller error handling
try {
  const result = await service.performOperation();
  res.json(result);
} catch (error) {
  console.error('Operation failed:', error);
  res.status(500).json({ error: 'Internal server error' });
}

// Database error handling
try {
  const stmt = db.prepare(sql);
  const result = stmt.run(params);
  return result;
} catch (error) {
  console.error('Database operation failed:', error);
  throw new Error('Database operation failed');
}
```

### Frontend Error Patterns
```typescript
// React component error handling
const [error, setError] = useState<string | null>(null);

const handleAction = async () => {
  try {
    setError(null);
    await performAction();
  } catch (err) {
    setError(err instanceof Error ? err.message : 'An error occurred');
  }
};
```

## Git Integration Patterns

### Worktree Operations
```bash
# Create worktree for task
git worktree add /path/to/worktree branch-name

# Check merge conflicts non-destructively
git merge-tree $(git merge-base branch1 branch2) branch1 branch2

# Cleanup orphaned worktrees
git worktree prune
```

## Performance Considerations

- Use SQLite indexes for frequently queried columns
- Implement pagination for large data sets
- Use WebSocket connections efficiently
- Optimize Docker images with multi-stage builds
- Use Vite's development server for fast frontend rebuilds

## AI Integration Notes

Supported AI developers and their commands:
- **Claude**: Via Claude Code CLI (auto-installed)
- **Codex**: OpenAI integration  
- **Gemini**: Google AI integration
- **Aider**: Multi-model support

Each runs in isolated worktrees with persistent context.

## Common Pitfalls to Avoid

1. **Frontend Import Issues**: Always use direct file imports, not index exports
2. **Database Queries**: Always use prepared statements to prevent SQL injection
3. **Git Operations**: Test git commands in isolated environments first
4. **WebSocket Connections**: Properly handle connection cleanup and error states
5. **Docker Builds**: Use appropriate .dockerignore files to optimize build context
6. **Async Operations**: Always handle Promise rejections properly

## Debugging Tips

### Backend Debugging
- Use `make logs` to view container logs
- Use `make shell` to access backend container
- Check SQLite database with `make db-shell`
- Monitor WebSocket connections through browser dev tools

### Frontend Debugging
- Use browser dev tools for React debugging
- Check Vite's dev server output for build issues
- Use TypeScript compiler for type checking
- Monitor network requests for API issues

## Security Best Practices

- Never commit secrets or API keys to version control
- Use environment variables for configuration
- Encrypt sensitive data before storing in database
- Validate all user inputs on both client and server
- Use HTTPS in production environments
- Implement proper CORS policies

## When Making Changes

1. **Read existing code** to understand patterns and conventions
2. **Run tests** before and after changes
3. **Use TypeScript** type checking to catch errors early
4. **Follow the existing** file structure and naming conventions
5. **Test in Docker** environment to ensure consistency
6. **Document complex** logic with clear comments
7. **Handle errors** appropriately for the context

This codebase values clarity, maintainability, and security. When in doubt, follow the existing patterns and ask for clarification on complex architectural decisions.