# Project Settings & Memory System Implementation Plan

## Overview

This document outlines the implementation plan for:
1. Project settings management (repository, credentials)
2. Engineer memory system (learning persistence)
3. Git worktree support for host agents
4. Quick initialization for new projects

## Goals

1. **Quick start experience**: Initialize a project with one command
2. **Enable engineer learning**: Engineers remember and improve over time
3. **Simplify credential management**: Set once per session, not per task
4. **Support parallel development**: Use git worktrees when possible, fallback gracefully
5. **Keep it local**: All data stays on user's machine for security

## Non-Goals

- Building a full knowledge graph (yet)
- Complex memory analysis/AI
- Multi-user sync (for now)
- Backwards compatibility (early development phase)

## Initialization Flow

```bash
# User adds repo in UI
# Then either:
1. Click "Initialize Project" button in UI
2. Or run: claude -p '/init'  # If in repo directory
```

**Smart Initialization:**
- Check for existing `CLAUDE.md` → Import as initial team memory
- Check for `README.md` → Extract project overview
- Check for `package.json`, `requirements.txt` → Understand tech stack
- Create `.pocketdev/` with sensible defaults

**Host Agent Modes:**
1. **With worktree permissions**: Full repo access in isolated branches
2. **Without worktree permissions**: 
   - Read main repo for context
   - Write to `.pocketdev/workspaces/{role}/`
   - Generate prototypes, utilities, examples
   - User reviews and copies what they want
   - Shows warning: "⚠️ Limited to workspace directory without worktree permissions"

## Architecture

### Directory Structure

```
project-root/                      # Your repository root (e.g., /home/user/projects/myapp)
├── .pocketdev/                    # PocketDev data directory (like .git or .github)
│   ├── config.json               # Project settings
│   ├── team-memory.md            # Shared team knowledge
│   ├── engineers/
│   │   ├── frontend-1.md         # Individual engineer memories
│   │   ├── backend-1.md
│   │   └── devops-1.md
│   └── workspaces/               # Host agent workspaces (no worktree mode)
│       ├── frontend/             # Frontend agent playground
│       ├── backend/              # Backend agent playground
│       └── devops/               # DevOps agent playground
├── .git/                         # Git repository data
├── .github/                      # GitHub specific files
├── src/                          # Your source code
└── .gitignore                    # Optionally exclude .pocketdev/

adjacent-directory/               # Only created if worktree permissions exist
└── {project-name}-worktrees/     # Git worktrees for parallel work
    ├── frontend-task-123/
    ├── backend-task-456/
    └── playground/               # Persistent playground branch
```

### File Formats

#### Project Config (.pocketdev/config.json)
```json
{
  "version": 1,
  "project": {
    "name": "pocketdev",
    "repository": "https://github.com/jeffeharris/pocketdev.git",
    "default_branch": "main"
  },
  "credentials": {
    "profile": "github-personal"
  },
  "settings": {
    "workspace_root": "/home/jeffh/projects",
    "host_agent_mode": "auto"
  },
  "initialized": "2024-01-07T10:30:00Z",
  "last_updated": "2024-01-07T10:30:00Z"
}
```

#### Team Memory (.pocketdev/team-memory.md)
```markdown
# Team Memory - PocketDev

Last updated: 2024-01-07

## Imported from CLAUDE.md
- See [Architecture](./CLAUDE.md#architecture)
- See [Conventions](./CLAUDE.md#conventions)

## Recent Discoveries

### 2024-01-07
- **frontend-1**: Toast notifications use react-hot-toast library
- **backend-1**: API rate limiting in middleware/rateLimit.js

### 2024-01-06  
- **frontend-1**: All modals use fixed positioning with z-50
- **devops-1**: Docker builds cache node_modules layer

## Architecture Overview
- Frontend: React 18 + TypeScript
- Backend: Node.js + Express  
- Database: PostgreSQL via Supabase

## Key Patterns
- Error handling: Toast notifications for user feedback
- Authentication: Token-based with refresh mechanism
- Testing: Jest for unit tests, Playwright for E2E
```

#### Engineer Memory (.pocketdev/engineers/frontend-1.md)
```markdown
# Frontend Engineer #1

Last task: 2024-01-07 - Add task detail modal
Total tasks completed: 12

## What I Know

### Component Patterns
- All components in `/web/src/components/`
- Use TypeScript function components
- Props interfaces defined above component
- Tailwind CSS for styling (className prop)

### State Management
- Global state via React Context
- Local state with useState/useReducer
- Server state with fetch + useEffect

### Key Files I Work With
- `/web/src/App.tsx` - Main app entry, routing logic
- `/web/src/components/` - All UI components
- `/web/tailwind.config.js` - Style configuration

## Recent Tasks

### 2024-01-07: Add task detail modal
- Created `/web/src/components/TaskDetailModal.tsx`
- Learned: Modals use fixed positioning with z-50
- Learned: Close on backdrop click is expected UX
- Duration: 5 minutes

### 2024-01-06: Implement real-time updates
- Modified `/web/src/App.tsx`
- Learned: 2-second polling works better than WebSockets here
- Learned: Show loading states during transitions
- Duration: 8 minutes

## Common Issues I've Solved
- **TypeScript event handlers**: Use React.MouseEvent<HTMLElement> types
- **Tailwind not applying**: Check PostCSS config, restart dev server
- **Module not found**: Check tsconfig paths and vite.config.ts
```

## Implementation Phases

### Phase 1: Credential Management (Priority!)

1. **Container Creation with Credentials**
```javascript
// Pass credentials during container creation
const dockerArgs = [
  'run', '--rm',
  '-e', `GIT_USERNAME=${profile.username}`,
  '-e', `GIT_TOKEN=${profile.token}`,
  // ... other args
];
```

2. **Config Loading**
```javascript
// Load .pocketdev/config.json from repository root
const config = await loadProjectConfig();
const profile = config.credentials.profile;

// Get credentials from env
const username = process.env[`${profile.toUpperCase()}_USERNAME`];
const token = process.env[`${profile.toUpperCase()}_TOKEN`];
```

3. **API Updates**
```
POST /api/project/config    # Set active project config
GET  /api/project/config    # Get current config
```

### Phase 2: Project Initialization & Memory

1. **Initialize Command**
```javascript
// Create .pocketdev/ structure
await fs.mkdir('.pocketdev/engineers', { recursive: true });
await fs.mkdir('.pocketdev/workspaces', { recursive: true });

// Create initial config.yml
await fs.writeFile('.pocketdev/config.yml', initialConfig);

// Import from CLAUDE.md if exists
if (await fs.exists('CLAUDE.md')) {
  const summary = await summarizeClaude();
  await fs.writeFile('.pocketdev/team-memory.md', summary);
}
```

2. **System Prompt Enhancement**
```
You have access to project memory files in .pocketdev/:
- Your personal memory: .pocketdev/engineers/${engineerId}.md
- Team shared memory: .pocketdev/team-memory.md

Read these files at the start of each task to understand the project.
Update your personal memory file when you learn something new.
Add important discoveries to team memory.
```

3. **No Memory Service Needed!**
- Engineers manage their own memory files
- System prompt tells them where files are
- Much simpler approach

### Phase 3: Git Worktree Support

1. **Worktree Tracking in config.yml**
```yaml
active_worktrees:
  - id: frontend-task-123
    branch: feature/add-modal
    created: 2024-01-07T10:30:00Z
    engineer: frontend-1
    path: ../pocketdev-worktrees/frontend-task-123
```

2. **Worktree Creation**
```javascript
// Check permissions
if (canCreateWorktrees) {
  await exec(`git worktree add ../pocketdev-worktrees/${taskId} -b ${branch}`);
} else {
  // Fallback to .pocketdev/workspaces/
  console.warn('Using workspace mode - no worktree permissions');
}
```

3. **Cleanup Strategy**
- Track in config.yml
- UI shows active worktrees
- Manual cleanup via UI
- Auto-cleanup after 7 days (configurable)

### Phase 4: Frontend UI

1. **Settings Page** (`/settings`)
- Configure repository URL
- Set default branch to work from
- Select credential profile  
- Set workspace root
- View/manage active worktrees

2. **Engineer Page** (`/engineers/:id`)
- Show engineer's current memory
- Display memory from current branch
- Task history for this engineer
- Current worktree/workspace

3. **Memory Viewer**
- For settings page: Show from default branch
- For engineer page: Show from engineer's current branch
- Simple markdown rendering
- Edit capability (future)

## Memory Integration with Claude

Keep it simple - let engineers manage their own memory:

```javascript
// Add to system prompt
const memoryContext = `
## Project Memory Files
You have access to memory files in .pocketdev/:
- Your memory: .pocketdev/engineers/${engineerId}.md  
- Team memory: .pocketdev/team-memory.md

Feel free to read these files to understand the project better.
Update your memory file with important learnings.
Add major discoveries to team memory.

Keep entries concise and dated.
`;

// That's it! Engineers handle the rest
```

**What we're NOT doing (yet):**
- Forcing specific formats
- Parsing responses for learnings
- Token optimization
- Automated summaries

**Why this approach:**
- Engineers know what's important to remember
- Natural language memory is more flexible
- Less system complexity
- Can refine based on actual usage patterns

## Security Considerations

### GitHub Integration Flow (Priority!)

**Native GitHub integration - no manual URL copying:**

```javascript
// Settings page flow
1. User enters GitHub token
2. Validate token with GitHub API
3. Fetch and display user's repos
4. User selects from dropdown
5. Fetch branches for selected repo
6. User picks default branch or creates new
7. Save configuration

// Implementation
const handleTokenEntry = async (token) => {
  // Validate token
  const response = await fetch('https://api.github.com/user', {
    headers: { 'Authorization': `token ${token}` }
  });
  
  if (!response.ok) {
    throw new Error('Invalid token');
  }
  
  // Fetch accessible repos
  const repos = await fetch('https://api.github.com/user/repos?per_page=100', {
    headers: { 'Authorization': `token ${token}` }
  });
  
  return repos.json();
};
```

**UI Flow:**
```
Enter Token → Select Repo → Choose Branch → Initialize → Done!
```

### Basic Security

1. **Credentials**
   - Stored in local `.env` file (never committed)
   - Passed to containers as environment variables
   - Token validation on entry

2. **Memory Files**
   - Stored in `.pocketdev/` and INCLUDED in git (this is a feature!)
   - Engineers build knowledge over time
   - Shared across team members

3. **Workspace Isolation**
   - Worktrees prevent conflicts
   - Each engineer gets isolated environment
   - No additional restrictions needed

## Future Enhancements

1. **GitHub Integration++**
   - GitHub app for better permissions
   - Automatic PR creation
   - Branch protection awareness

2. **Memory Evolution**
   - Memory templates for common patterns
   - Cross-project knowledge transfer
   - Memory search/query capabilities

3. **Multi-Provider Support**
   - OpenAI Codex engineers
   - Google Gemini engineers
   - Provider-specific memory formats

## Success Criteria

- [ ] Native GitHub integration - select repo from list, not paste URLs
- [ ] Credentials configured once per session via settings page
- [ ] Engineers read and update their memory files autonomously
- [ ] Worktrees enable parallel development (with graceful fallback)
- [ ] Project initialized with single click/command
- [ ] Memory files tracked in git for persistence

## Testing Plan

1. **GitHub Integration Flow**
   - Enter token → see repo list
   - Select repo → see branch list  
   - Initialize → creates .pocketdev/
   - Import CLAUDE.md if exists

2. **Memory System**
   - Engineer creates memory file on first task
   - Engineer reads memory on subsequent tasks
   - Team memory updates visible to all engineers

3. **Credential Management**
   - Configure once in settings
   - All tasks use configured credentials
   - No credentials in container logs

4. **Worktree Handling**
   - With permissions: creates worktrees
   - Without permissions: uses workspaces with warning
   - Parallel tasks don't conflict