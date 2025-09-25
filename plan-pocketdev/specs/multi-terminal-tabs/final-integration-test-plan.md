# Final Integration Test Plan - Multi-Terminal Tabs & Session Management

<!-- Document Metadata
Created: 2025-07-28
Modified: 2025-07-28
Status: ????
-->


## Overview
This test plan covers all features implemented in the session management and tab persistence branch.

## Test Environment Setup
1. Ensure all services are running: `make dev`
2. Clear any existing sessions in Shelltender
3. Have a test project with at least 2 tasks ready

## Feature Test Cases

### 1. Stable Session IDs (Task 1 & 2)
**Test Steps:**
1. Create a new task
2. Note the terminal session ID format (should be `task-{taskId}-{dbSessionId}`)
3. Refresh the page
4. Verify the same session ID is used (no new session created)

**Expected Results:**
- Session ID follows stable format
- No duplicate sessions created on refresh
- Session reconnects to existing Shelltender session

### 2. Session Persistence & Reconnection (Task 3 & 4)
**Test Steps:**
1. Open a task with existing terminal session
2. Run some commands in the terminal
3. Navigate away from the task
4. Return to the same task
5. Check terminal history is preserved

**Expected Results:**
- Terminal history remains intact
- Session reconnects automatically
- No new session created in database

### 3. Tab Persistence (Task 5)
**Test Steps:**
1. Open a task with multiple terminal tabs
2. Switch between tabs
3. Note which tab is active
4. Refresh the page
5. Verify active tab is restored

**Expected Results:**
- Active tab selection persists across page reloads
- Tab order is maintained
- All tabs reconnect properly

### 4. Multi-Terminal Tab Creation (Task 6)
**Test Steps:**
1. Click the + button to add a new tab
2. Right-click the + button for advanced options
3. Create a tab with custom settings (working directory, initial prompt)
4. Verify Claude auto-launches in quick-add tabs

**Expected Results:**
- New tabs get stable session IDs immediately
- Advanced options work correctly
- Claude launches automatically for quick-add
- Maximum 6 tabs enforced

### 5. Tab Renaming (Task 7)
**Test Steps:**
1. Double-click on a tab name
2. Enter a new name
3. Press Enter to save
4. Try pressing Escape to cancel
5. Verify renamed tab persists after refresh

**Expected Results:**
- Inline editing works smoothly
- Renamed tabs persist in database
- Cancel (Escape) works without saving
- Can click outside to save

### 6. Session Cleanup (Task 8)
**Test Steps:**
1. Note current Shelltender sessions: `curl http://localhost:8080/api/sessions`
2. Delete a task
3. Check Shelltender sessions again
4. Wait 5 minutes for cleanup service
5. Verify orphaned sessions are removed

**Expected Results:**
- Task deletion removes all associated Shelltender sessions
- Cleanup service removes orphaned sessions
- No accumulation of dead sessions

### 7. Disconnection Handling (Task 9)
**Test Steps:**
1. Open a terminal tab
2. Stop Shelltender service: `docker-compose stop shelltender`
3. Observe disconnection indicators
4. Restart Shelltender: `docker-compose start shelltender`
5. Verify automatic reconnection

**Expected Results:**
- Red pulsing indicator shows on disconnected tabs
- Toast notification appears for disconnection
- Automatic reconnection after 2 seconds
- Success notification on reconnection
- Reset button changes to orange when disconnected

## Integration Test Scenarios

### Scenario 1: Heavy Multi-Tab Usage
1. Create a task with 6 terminal tabs
2. Rename all tabs to meaningful names
3. Run different commands in each tab
4. Switch rapidly between tabs
5. Refresh page multiple times

**Expected Results:**
- All tabs maintain their state
- No performance degradation
- Tab names persist
- Active tab selection persists

### Scenario 2: Network Interruption
1. Open multiple terminal tabs
2. Simulate network issues (disconnect network briefly)
3. Reconnect network
4. Continue working

**Expected Results:**
- All tabs show disconnection state
- Automatic recovery when network returns
- No data loss
- Clear user feedback throughout

### Scenario 3: Task Lifecycle
1. Create a new task
2. Add 3 terminal tabs with different names
3. Work in all tabs
4. Archive the task
5. Create another task
6. Verify no session leakage

**Expected Results:**
- Clean session creation
- Proper cleanup on task archive
- No orphaned sessions
- New task starts fresh

## Performance Tests

### 1. Session Creation Speed
- Time how long it takes to create a new terminal tab
- Should be under 2 seconds

### 2. Tab Switching Performance
- With 6 tabs open, switching should be instant
- No lag or freezing

### 3. Memory Usage
- Monitor browser memory with 6 tabs open
- Should not continuously grow over time

## Edge Cases

### 1. Rapid Tab Creation/Deletion
- Quickly create and close tabs
- Verify no race conditions

### 2. Long Tab Names
- Try very long tab names
- Verify UI handles gracefully

### 3. Special Characters in Names
- Use quotes, slashes, etc. in tab names
- Verify proper escaping

### 4. Browser Back/Forward
- Use browser navigation
- Verify state consistency

## Known Issues & Limitations
1. Notification system uses Shelltender's toast (no custom styling)
2. Reconnection is basic (forces re-render)
3. No session state recovery (only reconnection)
4. Maximum 6 tabs per task (by design)

## Sign-off Checklist
- [ ] All test cases pass
- [ ] No console errors during testing
- [ ] Performance is acceptable
- [ ] User experience is smooth
- [ ] No session accumulation issues
- [ ] Cleanup service working properly

## Notes
- Run tests in both Chrome and Firefox
- Test with both fast and slow network conditions
- Verify Docker logs show no errors
- Check database for orphaned records after testing