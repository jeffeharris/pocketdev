# Multi-Terminal Tabs Implementation Handoff

<!-- Document Metadata
Created: 2025-07-28
Modified: 2025-07-28
Status: ????
-->


## Current Status: Phase 1 Complete ✅

Hello Claude! You're picking up the multi-terminal tabs feature implementation. Phase 1 (Backend Multi-Session Support) has been completed. This document will get you up to speed on what's been done and what needs to happen next.

## What We're Building

Multiple terminal tabs within each task, allowing developers to run concurrent AI sessions (Claude, Aider, etc.) for different purposes without switching between tasks. Think browser tabs, but for terminal sessions.

## What's Been Completed

### Phase 1: Backend Multi-Session Support ✅

1. **Database Changes**
   - Migration `003_multi_terminal_sessions.sql` has been applied
   - New columns added to `terminal_sessions` table:
     - `tab_name` - Display name for the tab
     - `tab_order` - Order of tabs (0-based)
     - `ai_session_id` - For tracking Claude session IDs
     - `ai_agent` - Which AI is running (claude, aider, etc.)
     - Session branching fields for future use

2. **API Endpoints**
   - `POST /api/tasks/:taskId/terminals` - Create new terminal session
     ```bash
     curl -X POST http://localhost:3005/api/tasks/{taskId}/terminals \
       -H "Content-Type: application/json" \
       -d '{
         "tabName": "Implementation",
         "aiAgent": "claude",
         "workingDirectory": "src",
         "initialPrompt": "Help me implement X"
       }'
     ```
   - `PATCH /api/terminals/:sessionId/tab` - Update tab properties
     ```bash
     curl -X PATCH http://localhost:3005/api/terminals/{sessionId}/tab \
       -H "Content-Type: application/json" \
       -d '{"tabName": "New Name", "tabOrder": 2}'
     ```

3. **Session Model Updates**
   - `findAllActiveByTaskId()` - Get all active sessions for a task
   - `updateTab()` - Update tab name/order
   - `delete()` - Remove a session
   - Auto-incrementing tab_order on creation

4. **Current Architecture**
   - Each tab gets a unique session ID: `task-{taskId}-{timestamp}`
   - Shelltender handles the actual terminal processes
   - Database tracks metadata and state per session

## What Needs to Be Done Next

### Phase 2: Basic Tab UI (HIGH PRIORITY)

**Goal**: Implement the visual tab system in the frontend

1. **Create TerminalTabs Component** (`frontend/src/components/terminal/TerminalTabs.tsx`)
   ```typescript
   interface Tab {
     sessionId: string;
     dbSessionId: string;
     tabName: string;
     tabOrder: number;
     aiState: 'not-started' | 'idle' | 'working' | 'waiting';
     aiAgent: string;
   }
   ```

2. **Update TerminalPanel** (`frontend/src/components/terminal/TerminalPanel.tsx`)
   - Currently has mock tabs (lines 58-82)
   - Replace with real TerminalTabs component
   - Manage multiple DirectTerminal instances
   - Handle tab switching

3. **API Integration**
   - Fetch all terminal sessions on task load
   - Call POST endpoint when plus button clicked
   - Update TaskWorkspace to manage tab state

4. **Key Considerations**
   - Only create DirectTerminal when tab is first clicked (lazy loading)
   - Maintain terminal refs for focus management
   - Handle WebSocket connections per terminal

### Phase 3: Quick Claude Launch

**Goal**: Plus button creates new tab with Claude auto-starting

1. **Auto-launch Logic**
   - After terminal ready, send `claude` command via WebSocket
   - Handle timing - wait for shell prompt
   - Show loading state during startup

2. **WebSocket Command Execution**
   ```javascript
   // After session created and terminal ready
   sendToTerminal(sessionId, 'claude\n');
   ```

### Phase 5: AI State Tracking (IMPORTANT)

**Current Issue**: AI state is tracked globally per task, not per session

1. **Update AI Session Monitor** (`backend/ai-session-monitor.js`)
   - Track state per sessionId, not just taskId
   - Update the patterns to include session context

2. **Update WebSocket Events**
   - Include sessionId in all `ai_state_update` events
   - Frontend needs to handle per-tab state

### Phase 6: Task Status Aggregation

**Goal**: Show intelligent task status based on all tabs

Priority order:
1. Waiting (purple) - Any tab needs attention
2. Working (yellow) - Any tab is processing  
3. Idle (blue) - All tabs ready
4. Not Started (gray) - No AI active

## Important Context

### Current Mock UI
The frontend already has mock tabs at `frontend/src/components/terminal/TerminalPanel.tsx` (lines 58-82). These need to be replaced with functional components.

### Session IDs
- Shelltender Session ID: `task-{taskId}-{timestamp}`
- Database Session ID: 8-character hex (e.g., `a4685707`)
- Both are needed for different purposes

### Git Configuration
Each session automatically configures git user name/email from settings when created.

### Working Directory
Sessions can start in subdirectories of the task worktree. The backend handles path resolution.

## Testing Your Implementation

### Backend is Ready
```bash
# Create a session
curl -X POST http://localhost:3005/api/tasks/1bf2f902/terminals \
  -H "Content-Type: application/json" \
  -d '{"tabName": "Test Tab", "aiAgent": "claude"}'

# Update tab name
curl -X PATCH http://localhost:3005/api/terminals/{dbSessionId}/tab \
  -H "Content-Type: application/json" \
  -d '{"tabName": "Renamed Tab"}'
```

### Expected Frontend Behavior
1. Task opens with one default tab
2. Plus button creates new tabs (max 6)
3. Click tab to switch terminals
4. Double-click to rename (Phase 6)
5. Tab shows AI state via colored indicator

## File Locations

### Backend (✅ Complete)
- `/backend/controllers/terminal.controller.js` - Endpoints
- `/backend/db/models/session.js` - Database model
- `/backend/routes/terminal.routes.js` - Route definitions

### Frontend (🚧 Needs Work)
- `/frontend/src/components/terminal/TerminalPanel.tsx` - Has mock tabs
- `/frontend/src/components/terminal/DirectTerminal.tsx` - Terminal component
- `/frontend/src/components/workspace/TaskWorkspace.tsx` - Parent component
- `/frontend/src/api/index.ts` - Add API calls here

### AI Monitoring (🚧 Needs Update)
- `/backend/ai-session-monitor.js` - Needs per-session tracking
- `/backend/ai-state-tracker.js` - State management

## Questions You Might Have

**Q: Why unique session IDs with timestamps?**
A: Shelltender requires unique IDs. The timestamp ensures uniqueness for multiple tabs.

**Q: What about the "initialPrompt" field?**
A: Stored in metadata but not yet used. Phase 3 will send it to Claude after launch.

**Q: How do tabs persist across reloads?**
A: Database stores all active sessions. Frontend should fetch them on mount.

**Q: What's the difference between sessionId and dbSessionId?**
A: sessionId is for Shelltender, dbSessionId is our database primary key.

## Next Steps

1. Start with Phase 2 - get basic tabs working
2. Test with multiple DirectTerminal instances
3. Then add Quick Claude Launch
4. Finally, fix AI state tracking

Good luck! The backend is solid and tested. Focus on making the frontend tabs functional first, then enhance with the advanced features.