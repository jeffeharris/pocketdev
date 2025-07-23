# Implementation Tasks for Session Management

## Overview
This document provides an ordered task list for implementing proper session management, tab persistence, and renaming functionality. Each checkpoint includes specific tests to confirm progress.

---

## Task 1: Update Backend Session Creation Logic

### Files to Modify:
1. **`backend/controllers/terminal.controller.js`** (~50 lines to modify)
   - Modify `createTerminalSession` function to:
     - Generate stable session ID using `task-${taskId}-${dbSession.id}`
     - Check if Shelltender session exists before creating
     - Return `isReconnected` flag in response

### New Code to Add:
```javascript
// Add helper function (~15 lines)
async function checkShelltenderSession(sessionId) {
  try {
    const shelltenderUrl = process.env.SHELLTENDER_API_URL || 'http://shelltender:8080';
    const response = await fetch(`${shelltenderUrl}/api/sessions/${sessionId}`);
    if (response.ok) {
      const session = await response.json();
      return session.status === 'active' ? session : null;
    }
    return null;
  } catch (error) {
    console.error('Error checking Shelltender session:', error);
    return null;
  }
}
```

### Checkpoint 1.1: Test Session Creation
**Test Commands:**
```bash
# Create a new terminal session
curl -X POST http://localhost:3005/api/tasks/{taskId}/terminals \
  -H "Content-Type: application/json" \
  -d '{"tabName": "Test Tab", "aiAgent": "claude"}'

# Check the response includes dbSessionId and shelltenderSessionId
# Verify shelltenderSessionId format is task-{taskId}-{dbSessionId}
```

**Expected Result:**
- Response includes `dbSessionId`, `shelltenderSessionId`, and `isReconnected: false`
- Only ONE new session appears in `curl http://localhost:8080/api/sessions`

**Commit Message:** `fix: implement stable session IDs for terminal creation`

---

## Task 2: Implement Session Reconnection

### Files to Modify:
1. **`backend/controllers/terminal.controller.js`** (~30 lines to modify)
   - Update session creation to check existing sessions first
   - Handle reconnection case

### Checkpoint 2.1: Test Session Reconnection
**Test Commands:**
```bash
# Create a terminal session (note the dbSessionId from response)
curl -X POST http://localhost:3005/api/tasks/{taskId}/terminals

# Create another session with same task - should get a new ID
curl -X POST http://localhost:3005/api/tasks/{taskId}/terminals

# Manually restart the backend
docker restart backend

# Try to create a session again - should reconnect to existing
curl -X POST http://localhost:3005/api/tasks/{taskId}/terminals
```

**Expected Result:**
- After restart, creating a session returns `isReconnected: true`
- No new Shelltender sessions created (verify count stays same)

**Commit Message:** `feat: add Shelltender session reconnection logic`

---

## Task 3: Load Terminal Sessions with Task

### Files to Modify:
1. **`backend/controllers/task.controller.js`** (~20 lines to modify)
   - Update `getTask` to include active terminal sessions
   - Add Shelltender status check for each session

2. **`backend/db/models/session.js`** (~5 lines to modify)
   - Ensure `findAllActiveByTaskId` orders by `tab_order`

### Checkpoint 3.1: Test Task Loading with Terminals
**Test Commands:**
```bash
# Get task with terminals
curl http://localhost:3005/api/tasks/{taskId}

# Response should include terminals array with session details
```

**Expected Result:**
- Task response includes `terminals` array
- Each terminal has `dbSessionId`, `shelltenderSessionId`, `tabName`, etc.
- Terminals are ordered by `tab_order`

**Commit Message:** `feat: include terminal sessions when loading tasks`

---

## Task 4: Update Frontend to Use Database Sessions

### Files to Modify:
1. **`frontend/src/types/task.ts`** (~10 lines)
   - Add `dbSessionId` and `shelltenderSessionId` to TerminalSession type

2. **`frontend/src/components/terminal/DirectTerminal.tsx`** (~20 lines)
   - Update props to accept both IDs
   - Use `shelltenderSessionId` for Terminal component

3. **`frontend/src/components/terminal/TerminalPanel.tsx`** (~40 lines)
   - Remove timestamp-based session ID generation
   - Use sessions from task.terminals
   - Update DirectTerminal props

### Checkpoint 4.1: Test Frontend Session Loading
**Manual Test Steps:**
1. Open browser to a task with existing terminals
2. Check browser console - should see "Connected to session: task-{taskId}-{dbSessionId}"
3. Refresh page - terminals should reload
4. Check Shelltender sessions - count should NOT increase

**Expected Result:**
- Terminals persist across page reloads
- No new Shelltender sessions created on reload
- Terminal content/history preserved

**Commit Message:** `fix: use stable session IDs in frontend components`

---

## Task 5: Implement Tab Persistence

### Files to Modify:
1. **`frontend/src/components/terminal/TerminalPanel.tsx`** (~30 lines)
   - Save active tab to localStorage
   - Restore active tab on mount
   - Handle empty terminals array properly

### Checkpoint 5.1: Test Tab Persistence
**Manual Test Steps:**
1. Open task with multiple tabs
2. Switch to tab 3
3. Refresh page
4. Should still be on tab 3

**Expected Result:**
- Active tab selection persists across reloads
- All tabs restore in correct order
- Terminal content preserved in each tab

**Commit Message:** `feat: persist active tab selection across page reloads`

---

## Task 6: Fix Tab Creation with Stable IDs

### Files to Modify:
1. **`frontend/src/services/api.ts`** (~10 lines)
   - Update `createTerminalSession` response type

2. **`frontend/src/components/terminal/TerminalPanel.tsx`** (~20 lines)
   - Update `handleTabAdd` to use response data correctly
   - Show toast notification if reconnected

### Checkpoint 6.1: Test New Tab Creation
**Manual Test Steps:**
1. Click + button to add new tab
2. Check browser console for session creation
3. Check Shelltender session count
4. Refresh page - new tab should persist

**Expected Result:**
- New tab appears with correct name
- Only one Shelltender session created
- Tab persists after refresh

**Commit Message:** `fix: ensure new tabs use stable session IDs`

---

## Task 7: Implement Tab Renaming

### Files to Modify:
1. **`backend/controllers/terminal.controller.js`** (~20 lines)
   - Add `updateTerminalTab` endpoint

2. **`backend/routes/terminal.routes.js`** (~2 lines)
   - Add PUT route for `/terminals/:sessionId`

3. **`frontend/src/components/terminal/TerminalTabs.tsx`** (~50 lines)
   - Add double-click handler
   - Add inline edit input
   - Handle submit/cancel

4. **`frontend/src/components/terminal/TerminalPanel.tsx`** (~15 lines)
   - Add `handleTabRename` function
   - Pass to TerminalTabs

5. **`frontend/src/services/api.ts`** (~10 lines)
   - Add `updateTerminalTab` API call

### Checkpoint 7.1: Test Tab Renaming
**Manual Test Steps:**
1. Double-click on any tab name
2. Type new name and press Enter
3. Refresh page - name should persist
4. Open same task in another browser - name should be consistent

**Expected Result:**
- Inline editing works smoothly
- Names persist in database
- WebSocket updates other clients (if implemented)

**Commit Message:** `feat: add tab renaming with double-click`

---

## Task 8: Add Session Cleanup

### Files to Create:
1. **`backend/services/session-cleanup.service.js`** (~50 lines new file)
   - Create cleanup service class
   - Add orphaned session detection
   - Add termination logic

### Files to Modify:
1. **`backend/server.js`** (~10 lines)
   - Initialize cleanup service
   - Schedule periodic cleanup

### Checkpoint 8.1: Test Cleanup Service
**Test Commands:**
```bash
# Check current session count
curl http://localhost:8080/api/sessions | jq '. | length'

# Restart backend to trigger cleanup
docker restart backend

# Wait 30 seconds, check count again
curl http://localhost:8080/api/sessions | jq '. | length'
```

**Expected Result:**
- Session count drops significantly (from 80+ to actual active tabs)
- Only sessions with active DB records remain
- Console logs show cleanup activity

**Commit Message:** `feat: add orphaned session cleanup service`

---

## Task 9: Handle Session Disconnections

### Files to Modify:
1. **`frontend/src/components/terminal/DirectTerminal.tsx`** (~20 lines)
   - Add `onSessionStatus` callback
   - Handle connection errors

2. **`frontend/src/components/terminal/TerminalPanel.tsx`** (~30 lines)
   - Add session status handler
   - Show error notifications
   - Implement session recreation

### Checkpoint 9.1: Test Session Recovery
**Manual Test Steps:**
1. Open task with terminal
2. Manually delete Shelltender session: `curl -X DELETE http://localhost:8080/api/sessions/{sessionId}`
3. Try to use terminal
4. Should show error and offer to recreate

**Expected Result:**
- Error notification appears
- Option to recreate session
- New session connects successfully

**Commit Message:** `feat: handle session disconnections gracefully`

---

## Task 10: Final Integration Testing

### No Files to Modify - Testing Only

### Checkpoint 10.1: Full Feature Test
**Manual Test Steps:**
1. Create new task
2. Add 3 tabs with different names
3. Launch Claude in tab 2
4. Rename tab 3 to "Testing"
5. Refresh page
6. Verify:
   - All 3 tabs restored
   - Tab 2 still has Claude running
   - Tab 3 still named "Testing"
   - Active tab preserved
7. Check Shelltender sessions - should only have 3 for this task

**Expected Result:**
- Complete feature works end-to-end
- No session leaks
- Smooth user experience

**Commit Message:** `test: verify complete session management implementation`

---

## Summary

**Total Implementation Effort:**
- ~400 lines of code changes across 10 files
- 1 new file created
- 10 checkpoints with specific tests
- Each checkpoint represents a working, committable state

**Key Metrics to Track:**
- Shelltender session count (should drop from 80+ to actual active tabs)
- Page reload time (should improve with fewer sessions)
- User experience (tabs persist, names editable, sessions stable)

**Critical Success Factors:**
- No new sessions on page reload
- Tab state fully persistent
- Clean separation between database session ID and Shelltender session ID
- Graceful handling of disconnections