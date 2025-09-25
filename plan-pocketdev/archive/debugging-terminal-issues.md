# Debugging Terminal Issues

<!-- Document Metadata
Created: 2025-07-22
Modified: 2025-07-22
Status: ????
-->


## Current Issues
1. No bash prompt showing
2. Claude not auto-launching

## Quick Debug Steps

### 1. Check if Shelltender is creating sessions properly

Open browser console and run:
```javascript
// Check if WebSocket is connected
console.log('Checking Shelltender WebSocket...');
```

### 2. Test manual command execution

In the browser console when a terminal is open:
```javascript
// Get the terminal ref
const terminalPanel = document.querySelector('[data-terminal-panel]');
// Try sending a command manually
```

### 3. Check backend logs

```bash
# Check if sessions are being created
docker logs pocketdev-backend-1 | grep -i "terminal\|session"

# Check Shelltender logs
docker logs pocketdev-shelltender-1 | tail -50
```

### 4. Test the bash prompt directly

Create a test session via curl:
```bash
curl -X POST http://localhost:3005/api/tasks/{taskId}/terminals \
  -H "Content-Type: application/json" \
  -d '{
    "tabName": "Debug Test",
    "aiAgent": "claude"
  }'
```

Then check if the session was created in Shelltender:
```bash
curl http://localhost:8080/api/sessions
```

### 5. Check if initialization commands are running

The backend should be running these commands after session creation:
- Source bashrc
- Set git config
- Clear terminal

You can check if these ran by looking at the terminal output or checking:
```bash
# In the terminal, check if PS1 is set
echo $PS1

# Check if history file exists
ls -la .pocketdev_task_history
```

## Potential Fixes

### Fix 1: Force PS1 in initialization
Instead of relying on environment variables, we could explicitly set PS1 after the session starts:

```javascript
await executeCommand(sessionId, `export PS1='\\[\\033[01;32m\\]\\u@pocketdev\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ '`);
```

### Fix 2: Add debug output
Add console.log statements in:
- `DirectTerminal.tsx` - when monitoring output
- `TerminalPanel.tsx` - in handleTerminalReady
- Check if `terminalReady` is ever becoming true

### Fix 3: Simplify prompt detection
The prompt regex might be too strict. Try detecting any line ending with `$ ` or `# `.

## Testing Auto-Launch

To test if the auto-launch logic is working:

1. Open browser DevTools
2. Go to Network tab
3. Filter by WS (WebSocket)
4. Create a new tab
5. Look for messages with type: 'input' and data: 'claude\n'

If you don't see this message, the auto-launch isn't firing.