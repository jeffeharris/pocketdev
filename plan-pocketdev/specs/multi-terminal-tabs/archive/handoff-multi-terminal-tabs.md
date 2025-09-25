# Multi-Terminal Tabs Feature - Complete Handoff Document

<!-- Document Metadata
Created: 2025-07-28
Modified: 2025-07-28
Status: ????
-->


## Feature Overview
The Multi-Terminal Tabs feature enables developers to run multiple concurrent AI sessions within a single task through a tabbed interface. This eliminates the need to switch between tasks for different development activities.

## Implementation Status (2025-07-22)

### Completed Phases
- ✅ **Phase 1: Backend Terminal Session Persistence**
  - Database schema with `terminal_sessions` table
  - Support for up to 6 concurrent terminals per task
  - Session state persistence across server restarts
  
- ✅ **Phase 2: Frontend Tab UI**
  - TerminalTabs component with visual state indicators
  - Tab management (add/remove/switch)
  - Real-time AI state visualization
  - Refactored TerminalPanel for multiple terminals

- ✅ **Phase 3: Quick Claude Launch**
  - Auto-launch Claude in new tabs
  - WebSocket-based command execution
  - Visual loading feedback

### Pending Phases
- ⏸️ Phase 4: Advanced Session Launcher
- ⏸️ Phase 5: Task Status Aggregation
- ⏸️ Phase 6: Session State Persistence (tab restoration)
- ⏸️ Phase 7: Specialized Session Types

## Key Implementation Details

### Backend Architecture
1. **Database Changes**
   - Added `terminal_sessions` table with fields: id, task_id, session_id, tab_name, tab_order, ai_state, ai_agent
   - Removed unique constraint on active sessions to allow multiple per task

2. **API Endpoints**
   - `GET /api/projects/:projectId/tasks/:taskId/terminals` - List terminals for task
   - `POST /api/sessions/:sessionId/execute` - Execute command in session

3. **WebSocket Integration**
   - Created `backend/utils/execute-command.js` for Shelltender v0.6.1 compatibility
   - Direct WebSocket connection without "attach" messages
   - Proper error handling and timeouts

### Frontend Components
1. **TerminalTabs Component** (`frontend/src/components/terminal/TerminalTabs.tsx`)
   - Renders tab bar with state indicators
   - Handles tab selection and close events
   - Shows AI state with colored dots

2. **TerminalPanel Refactor** (`frontend/src/components/terminal/TerminalPanel.tsx`)
   - Manages multiple DirectTerminal instances
   - Handles tab creation and auto-launch
   - Tracks launching state for visual feedback

3. **Type Updates** (`frontend/src/types/task.ts`)
   - Added `terminals` array to Task interface
   - Defined Tab interface with session info

## Known Issues
1. **Tab Persistence** - Tabs don't restore after page refresh (database records exist but UI doesn't restore)
2. **AI State Tracking** - Still shows gray indicator after Claude is ready (Phase 5 will fix)
3. **Launch Control** - No way to create bash-only tab or cancel auto-launch

## Testing the Feature
1. Navigate to any task
2. Click the plus button to create new tabs
3. Watch Claude auto-launch in each tab
4. Switch between tabs to see independent sessions
5. Close tabs (except the last one)

## Code Locations
- Backend controllers: `/backend/controllers/terminal.controller.js`, `/backend/controllers/task.controller.js`
- Frontend components: `/frontend/src/components/terminal/TerminalTabs.tsx`, `/frontend/src/components/terminal/TerminalPanel.tsx`
- API service: `/frontend/src/services/api.ts`
- WebSocket utility: `/backend/utils/execute-command.js`
- Database schema: `/backend/db/schema.sql`

## Next Steps
1. Fix tab persistence issue
2. Implement Phase 4 (Advanced Session Launcher) for AI agent selection
3. Add proper AI state detection for accurate indicators
4. Consider making auto-launch delays configurable

## Architecture Decisions
1. **WebSocket for Commands** - Shelltender v0.6.1 requires WebSocket for command execution, not HTTP
2. **Multiple DirectTerminal Instances** - Each tab gets its own terminal component instance
3. **Session ID Format** - Using `task-{taskId}-{timestamp}` for unique session identification
4. **Maximum Tabs** - Limited to 6 concurrent sessions per task for resource management

This feature significantly improves the developer experience by enabling parallel AI workflows within a single task context.