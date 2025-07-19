# Shelltender v0.6.1 Monitoring Architecture

## Overview

After upgrading to Shelltender v0.6.1, the monitoring architecture changed significantly. This document explains how PocketDev monitors AI sessions with the new version.

## Key Changes from Previous Versions

### Before (v0.4.x - v0.5.x)
- Single "monitor mode" WebSocket connection
- Received output from ALL sessions automatically
- Used `ShelltenderMonitorAdapter` with authentication

### Now (v0.6.1+)
- Individual WebSocket connections per session
- Must explicitly create/attach to each session
- Uses `ShelltenderSessionMonitor` to manage connections

## Architecture Components

### 1. ShelltenderSessionMonitor (`backend/shelltender-session-monitor.js`)

Manages WebSocket connections to individual terminal sessions:

```javascript
// Connects to a specific session
await sessionMonitor.connectToSession('task-123');

// Registers callback for terminal output
sessionMonitor.onData((sessionId, data, metadata) => {
  // Process terminal output
});
```

Key features:
- Automatic reconnection on disconnect
- Handles both existing and new sessions
- Compatible with AISessionMonitor's interface

### 2. AISessionMonitor (`backend/ai-session-monitor.js`)

Analyzes terminal output to detect AI states:

**Pattern Detection:**
- Claude thinking: `/([✻●◉◎✢✶✽✺○·])\s+\w+ing….*\d+s.*tokens/`
- Claude prompt: `/│\s*>\s*│/`
- Bash prompt: `/root@[\w-]+:[\w/~-]+#\s*$/`
- Confirmation dialogs, errors, etc.

**AI States:**
- `not-started` (gray) - No AI session, at bash prompt
- `idle` (blue) - AI active but waiting for input
- `working` (yellow) - AI is thinking/processing
- `waiting` (purple) - AI needs user confirmation

### 3. Integration Flow

```
1. Task Created
   ↓
2. Shelltender session created (via API)
   ↓
3. SessionMonitor connects to session WebSocket
   ↓
4. Terminal output flows through WebSocket
   ↓
5. AISessionMonitor detects patterns
   ↓
6. State changes broadcast to frontend
   ↓
7. UI updates task status indicators
```

## WebSocket Protocol

### Connection
```javascript
const ws = new WebSocket('ws://shelltender:8080/ws');
```

### Message Types

**Create/Attach Session:**
```json
{
  "type": "create",
  "sessionId": "task-123"
}
```

**Terminal Output (from Shelltender):**
```json
{
  "type": "output",
  "sessionId": "task-123",
  "data": "terminal output text\r\n"
}
```

**Send Input:**
```json
{
  "type": "input",
  "sessionId": "task-123",
  "data": "command\n"
}
```

## Implementation Details

### Server Initialization (`backend/server.js`)

```javascript
// Create session monitor
const sessionMonitor = await createSessionMonitor({
  wsUrl: config.shelltenderWsUrl,
  apiUrl: config.shelltenderApiUrl
});

// Create AI monitor with session monitor
aiMonitor = new AISessionMonitor(
  sessionMonitor, 
  wsClient, 
  notificationService, 
  wsEventService, 
  models
);
```

### New Task Connection (`backend/controllers/task.controller.js`)

When a new task is created:
```javascript
// Create Shelltender session
await createTaskSession(taskId, worktreePath);

// Connect monitor to the new session
const sessionId = `task-${taskId}`;
await sessionMonitor.connectToSession(sessionId);
await aiMonitor.registerSessionPatterns(sessionId);
```

## Debugging

### Check Active Connections
```bash
docker compose logs backend | grep -E "(Connecting to session|Session.*created|Monitoring.*sessions)"
```

### Monitor Terminal Output
Look for debug logs (can be removed in production):
```bash
docker compose logs backend | grep "DEBUG.*Output from"
```

### Verify AI State Detection
```bash
curl -s http://localhost:3005/api/tasks | jq '.[] | {id, title, sessionState}'
```

## Migration Notes

If upgrading from an older version:
1. Remove any references to `ShelltenderMonitorAdapter`
2. Update configuration to use `/ws` endpoint
3. Ensure `SHELLTENDER_WS_URL` includes `/ws` path
4. The monitor auth key is no longer used

## Known Limitations

1. Each task requires its own WebSocket connection
2. No global event stream for all sessions
3. Must explicitly connect to new sessions
4. Connection count scales with number of active tasks

## Future Improvements

- Connection pooling for many tasks
- Exponential backoff for reconnections
- Metrics and monitoring dashboard
- Batch message processing