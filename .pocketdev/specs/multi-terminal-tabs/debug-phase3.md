# Debugging Phase 3 Auto-Launch

## Issue
The auto-launch functionality is not working - Claude is not being launched when creating new tabs.

## Debugging Steps

### 1. Manual Test via cURL
Test if the execute endpoint works at all:

```bash
# First, get the terminal sessions for a task
curl http://localhost:3005/api/tasks/{taskId}/terminals

# Then try to execute a command
curl -X POST http://localhost:3005/api/sessions/{sessionId}/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "echo test"}'
```

### 2. Browser Console Tests
Open browser console and manually test:

```javascript
// Get the API service
const api = window.api || await import('/src/services/api.js').then(m => m.api);

// Find a terminal session ID from the UI
const sessionId = 'YOUR_SESSION_ID_HERE';

// Try to execute a command
await api.executeCommand(sessionId, 'echo "Hello from browser"');
```

### 3. Check Console Logs
When clicking the plus button, you should see:
- `[TerminalPanel] handleTabAdd called`
- `[TerminalPanel] Creating new terminal session...`
- `[TerminalPanel] New session created: {sessionId: ...}`
- `[TerminalPanel] Setting timeout for Claude launch...`
- After 2 seconds:
  - `[TerminalPanel] Auto-launching Claude for new tab: ...`
  - `[API] executeCommand called: {sessionId: ..., command: "claude"}`

### 4. Common Issues

1. **Session ID mismatch**: The frontend might be using a different session ID format than the backend expects
2. **Timing issue**: Terminal might not be ready in 2 seconds
3. **API endpoint issue**: The `/sessions/:sessionId/execute` endpoint might not be working
4. **WebSocket vs HTTP**: There might be a disconnect between terminal creation and command execution

### 5. Quick Fix Test
Try increasing the timeout from 2 to 5 seconds:

```javascript
// In TerminalPanel.tsx, change:
}, 2000); // Wait 2 seconds for terminal to be ready

// To:
}, 5000); // Wait 5 seconds for terminal to be ready
```

### 6. Alternative Approach
If the API approach doesn't work, we might need to:
1. Use the backend to send commands directly to Shelltender
2. Create a new endpoint specifically for launching Claude
3. Use a different mechanism to detect terminal readiness

## Next Steps
1. Check if commands work manually via cURL
2. Verify session IDs match between frontend and backend
3. Look at Shelltender logs for any errors
4. Consider alternative implementation approaches