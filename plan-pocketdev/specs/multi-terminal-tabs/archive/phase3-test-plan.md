# Phase 3 Test Plan - Quick Claude Launch

## Test Environment Setup
1. Ensure all services are running: `make dev`
2. Open browser developer console to monitor WebSocket messages
3. Navigate to a task workspace

## Test Cases

### 1. Terminal Ready Detection ✅
- [ ] DirectTerminal detects bash prompt patterns
- [ ] onReady callback fires when terminal is ready
- [ ] Ready state persists correctly
- [ ] 5-second timeout fallback works if no prompt detected

### 2. Auto-Launch Claude ✅
- [ ] Click plus button to create new tab
- [ ] New tab shows yellow "working" indicator immediately
- [ ] Terminal connects and shows bash prompt
- [ ] 'claude' command automatically sent to terminal
- [ ] Claude startup messages appear in terminal
- [ ] Yellow indicator remains during Claude initialization
- [ ] Blue indicator appears when Claude shows its prompt

### 3. Multiple Quick Launches ✅
- [ ] Create multiple tabs rapidly
- [ ] Each tab launches Claude independently
- [ ] No race conditions or command mix-ups
- [ ] Each terminal maintains separate Claude session

### 4. Error Handling ✅
- [ ] If Claude fails to start, tab remains functional
- [ ] Terminal remains usable for manual commands
- [ ] No JavaScript errors in console

### 5. State Persistence ✅
- [ ] Refresh page after Claude launches
- [ ] Tabs restore with correct AI states
- [ ] Claude sessions remain active after refresh

## Implementation Details

### Simplified Auto-Launch Approach
The implementation now uses a simpler, more reliable approach:
- No complex terminal output monitoring
- Uses backend API endpoint `/sessions/:sessionId/execute`
- Fixed 2-second delay after terminal creation
- Direct command execution via HTTP POST

### Auto-Launch Flow
1. User clicks plus button
2. New terminal session created with "launching" state
3. Tab shows yellow indicator immediately
4. Wait 2 seconds for terminal to be ready
5. Send 'claude' command via backend API
6. Yellow indicator persists for 3 seconds or until error
7. Phase 5 will implement proper AI state detection

### Backend API Command Format
```javascript
await api.executeCommand(sessionId, 'claude');
// Sends POST to /api/sessions/{sessionId}/execute
// Body: { command: 'claude' }
```

## Known Limitations
1. AI state indicators still show gray for all tabs (except during launch)
   - Phase 5 will implement full per-session state tracking
2. No way to cancel Claude launch once started
3. No error recovery if Claude command fails

## Manual Testing Script

```bash
# 1. Start the dev environment
make dev

# 2. Open browser to http://localhost:5173
# 3. Navigate to a project and open a task
# 4. Click the plus button multiple times
# 5. Observe each tab launching Claude automatically
# 6. Switch between tabs to verify independent sessions
# 7. Refresh the page to test persistence
```

## Success Criteria
✅ New tabs automatically launch Claude
✅ Loading state (yellow) shows during launch
✅ Multiple tabs can launch concurrently
✅ No manual intervention required
✅ Terminals remain functional if launch fails