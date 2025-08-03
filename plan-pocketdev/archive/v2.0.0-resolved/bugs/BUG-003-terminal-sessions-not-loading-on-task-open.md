# BUG-003: Terminal Sessions Not Loading on Task Open

## Summary
When opening a task that has existing terminal sessions, the terminals are not displayed until a new terminal is created. Once a new terminal is created, all previously existing terminals suddenly appear.

## Environment
- Frontend: React with TypeScript
- Terminal Store: Zustand-based state management
- API: Express backend returning task details with terminals array

## Steps to Reproduce
1. Open PocketDev
2. Navigate to a project (e.g., pocketdev project)
3. Click on a task that has existing terminal sessions (verified via API)
4. Observe that no terminals are shown
5. Create a new terminal session
6. Observe that all previously existing terminals now appear

## Expected Behavior
When opening a task, all existing terminal sessions should be loaded and displayed immediately.

## Actual Behavior
Terminal sessions are not displayed until a new terminal is created, at which point all terminals (old and new) appear.

## Investigation Findings

### API Response Structure
The API correctly returns terminals when fetching individual task details:
```bash
curl -s http://localhost:3005/api/projects/{projectId}/tasks/{taskId} | jq '.terminals'
# Returns array of terminal objects with sessionId, dbSessionId, etc.
```

### Code Analysis
1. **TaskWorkspace.tsx** (lines 113-127):
   - Calls `api.getTask(projectId, taskId)` when taskId changes
   - Updates terminal store with `setTerminals(taskId, taskDetails.terminals)`
   - The code appears correct

2. **Terminal Store**:
   - Has proper `setTerminals` method for bulk loading
   - Not being cleared anywhere unexpectedly

3. **Task List API**:
   - The `/api/projects/{id}/tasks` endpoint does NOT include terminals
   - Only the individual task endpoint includes them

### Root Cause Hypothesis
The issue appears to be a race condition or initialization problem where:
1. The task details API call might be failing or not completing
2. The terminal store update might be happening before components are ready
3. WebSocket events from creating a new terminal might trigger a different code path that properly loads all terminals

## Affected Components
- `/frontend/src/components/task/TaskWorkspace.tsx`
- `/frontend/src/stores/terminalStore.ts`
- `/frontend/src/components/terminal/TerminalPanel.tsx`

## Priority
Medium - Users can work around by creating a new terminal, but it's confusing UX

## Potential Fix Directions
1. Add error logging to `loadTaskDetails` to see if the API call is failing
2. Verify the timing of when `setTerminals` is called vs when components read from the store
3. Check if WebSocket events are triggering additional data loads that should happen on initial mount
4. Consider adding a loading state to prevent race conditions