# Multi-Terminal Tabs - Phase 2 Complete Handoff

<!-- Document Metadata
Created: 2025-07-28
Modified: 2025-07-28
Status: ????
-->


## Status Update
Phase 2 (Basic Tab UI) is now complete! Users can create and switch between multiple terminal tabs within a single task.

## What Was Accomplished

### Frontend Components
1. **TerminalTabs Component** (`frontend/src/components/terminal/TerminalTabs.tsx`)
   - Tab rendering with AI state indicators
   - Tab selection and switching
   - Plus button for new tabs (max 6)
   - Dynamic state colors (gray/blue/yellow/purple)

2. **TerminalPanel Refactor** (`frontend/src/components/terminal/TerminalPanel.tsx`)
   - Support for multiple DirectTerminal instances
   - Tab state management
   - Focus management across terminals
   - Auto-creation of first tab

3. **API Integration** (`frontend/src/services/api.ts`)
   - `getTerminalSessions()` - Fetch all terminals for a task
   - `createTerminalSession()` - Create new terminal tab
   - `updateTerminalTab()` - Update tab properties
   - `deleteTerminalSession()` - Delete terminal (future use)

4. **Type Updates** (`frontend/src/types/task.ts`)
   - Added `TerminalSession` interface
   - Added `terminals` array to Task type

### Backend Updates
1. **Task Controller** (`backend/controllers/task.controller.js`)
   - Modified `getTask` to include terminals array
   - Maps terminal data to frontend format

## Current User Experience

1. **Opening a Task**
   - If no terminals exist, auto-creates "Main" tab
   - If terminals exist, restores all tabs with correct order
   - First tab is selected by default

2. **Creating New Tabs**
   - Click plus button
   - New tab named "Tab 2", "Tab 3", etc.
   - Immediately switches to new tab
   - Each tab gets independent terminal session

3. **Tab Indicators**
   - Gray dot = bash prompt (no AI)
   - Blue dot = Claude idle
   - Yellow dot = Claude working
   - Purple dot = Claude waiting

4. **Persistence**
   - All tabs persist across page reloads
   - Tab names and order preserved
   - Active tab selection maintained

## Testing Instructions

### Manual Testing
1. Start dev environment: `make dev`
2. Open a task in the UI
3. Click plus button to add tabs
4. Switch between tabs
5. Refresh page to verify persistence

### API Testing
```bash
# Create new tab
curl -X POST http://localhost:3005/api/tasks/{taskId}/terminals \
  -H "Content-Type: application/json" \
  -d '{"tabName": "Testing", "aiAgent": "claude"}'

# Update tab name
curl -X PATCH http://localhost:3005/api/terminals/{dbSessionId}/tab \
  -H "Content-Type: application/json" \
  -d '{"tabName": "Unit Tests"}'
```

## Known Limitations

1. **AI State Updates**
   - Currently shows gray for all tabs
   - Phase 5 will implement per-session state tracking

2. **Claude Auto-Launch**
   - New tabs start at bash prompt
   - Phase 3 will add auto-launch capability

3. **Tab Management**
   - No rename (double-click) yet - Phase 6
   - No reorder (drag) yet - Phase 6
   - No close functionality yet - Phase 6
   - No keyboard shortcuts yet - Phase 6

## Next Phase: Quick Claude Launch

### Overview
Phase 3 will make the plus button automatically start Claude in new tabs.

### Key Tasks
1. Detect when terminal is ready (prompt appears)
2. Send 'claude' command via WebSocket
3. Show loading state during startup
4. Handle errors gracefully

### Implementation Hints
```javascript
// After terminal ready
const sendCommand = (sessionId: string, command: string) => {
  // Use Shelltender WebSocket to send command
  ws.send(JSON.stringify({
    type: 'input',
    sessionId,
    data: command + '\n'
  }));
};

// Wait for prompt, then:
sendCommand(newSession.sessionId, 'claude');
```

## File Structure Reference

### Frontend
```
frontend/src/
├── components/terminal/
│   ├── TerminalPanel.tsx      # Main container (refactored)
│   ├── TerminalTabs.tsx       # Tab UI component (new)
│   └── DirectTerminal.tsx     # Terminal instance (unchanged)
├── services/
│   └── api.ts                 # Added terminal endpoints
└── types/
    └── task.ts                # Added TerminalSession type
```

### Backend
```
backend/
├── controllers/
│   └── task.controller.js     # Modified to include terminals
└── routes/
    └── terminal.routes.js     # Already has endpoints
```

## Success Metrics
✅ Multiple tabs per task
✅ Independent terminal sessions
✅ Visual state indicators
✅ Tab persistence
✅ Smooth switching
✅ Focus management

Great work on Phase 2! The foundation is solid for adding advanced features.