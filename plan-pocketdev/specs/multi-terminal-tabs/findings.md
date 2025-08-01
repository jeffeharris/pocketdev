# Multi-Terminal Tabs Investigation Findings

## Current State

### Frontend Implementation
- **Location**: `/frontend/src/components/terminal/TerminalPanel.tsx` (lines 58-82)
- **Status**: Visual mockup only - no functionality
- **UI Elements**:
  - Three hardcoded tabs: Implementation (active), Planning, Testing
  - Plus button for adding new tabs (non-functional)
  - Visual indicators (green = active, gray = inactive)
  - Hover effects but no click handlers

### Backend Capabilities
- **Shelltender Version**: v0.6.1 with admin UI
- **Multi-session Support**: Fully supported
- **Session Management API**:
  ```
  POST   /api/sessions              - Create new session
  GET    /api/sessions              - List all sessions
  GET    /api/sessions/:sessionId   - Get session info
  DELETE /api/sessions/:sessionId   - Terminate session
  POST   /api/sessions/:sessionId/resize - Resize terminal
  ```

### Database Schema
- **terminal_sessions table**:
  - Supports multiple sessions per task
  - Only one marked as `is_active` at a time
  - Tracks: session_id, task_id, shelltender_session_id, ai_state, timestamps

## Shell Launch Configuration

### Current Behavior
1. **Shell Command**: `/bin/bash --login`
2. **Working Directory**: Task worktree path
3. **Environment Variables**:
   - `TERM=xterm-256color`
   - `TASK_ID={taskId}`
   - `WORKTREE_PATH={path}`
4. **Security**: 
   - Path restrictions via Shelltender
   - Blocked commands: sudo, su, chmod, chown
   - No bash restricted mode (rbash)

### Claude Code Integration
- **Installation**: Pre-installed globally via npm
- **Launch**: Manual - user must type `claude`
- **Session Resumption**:
  - `claude --continue` - Resume most recent
  - `claude --resume <id>` or `claude -r <id>` - Resume specific session
- **Initial Prompts**: Supported via `claude "prompt text"`

## State Management

### AI State Tracking
- **States**: not-started, idle, working, waiting
- **Monitoring**: Pattern matching on terminal output
- **Broadcasting**: WebSocket events to subscribed clients
- **Display**: TaskStatus component shows single state per task

### Current Limitations
1. Database assumes one active session per task
2. AI state updates globally per task, not per terminal
3. WebSocket events don't include terminal identifiers
4. TaskStatus UI shows single worker state

## Technical Architecture

### Component Hierarchy
```
TaskWorkspace
  └── TerminalPanel (one per task)
       ├── Tab Bar (visual only)
       └── DirectTerminal (single instance)
```

### Session ID Structure
- **Shelltender Session**: `task-{taskId}` format
- **Claude Session**: UUID format, stored locally by Claude Code
- **Relationship**: Not currently tracked together

## Infrastructure Readiness

### What's Ready
- ✅ Shelltender supports multiple concurrent sessions
- ✅ WebSocket infrastructure for real-time updates
- ✅ Session persistence and restoration
- ✅ Independent PTY processes per session
- ✅ Claude Code supports session resumption

### What Needs Work
- ❌ Frontend tab functionality
- ❌ Multi-session state aggregation
- ❌ Database schema for multiple active sessions
- ❌ Session ID relationship tracking
- ❌ Advanced session launcher UI