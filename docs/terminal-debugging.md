# Terminal Debugging Guide

<!-- Document Metadata
Created: 2025-07-28
Modified: 2025-07-28
Status: ????
-->


This guide explains the terminal debugging tools available in PocketDev for troubleshooting WebSocket and terminal buffer issues.

## Terminal Buffer Restoration

As of Shelltender v0.6.2, terminal buffer restoration requires the `useIncrementalUpdates` prop to be set to `true` on the Terminal component. This enables the incremental update protocol which properly handles scrollback data on reconnection.

```tsx
<Terminal
  sessionId={sessionId}
  useIncrementalUpdates={true}  // Required for buffer restoration
  cursorStyle="block"
  cursorBlink={false}
/>
```

## Debug Tools

### 1. Terminal Buffer Test Page (`/test/terminal-buffer`)

A dedicated test page for isolating terminal buffer restoration issues.

**Features:**
- Automatically finds and loads the first available terminal session
- Provides buttons for different refresh scenarios:
  - **Clear Storage & Reload** - Clears all browser storage and reloads
  - **Soft Refresh** - Remounts the terminal component without page reload
  - **Hard Refresh** - Standard browser refresh
- Shows current session ID
- Uses the debug terminal component with extensive logging

**Usage:**
1. Navigate to `http://localhost:5173/test/terminal-buffer`
2. Open browser developer console to see debug logs
3. Run some commands in the terminal
4. Use the refresh buttons to test buffer restoration
5. Check console for WebSocket messages and scrollback data

### 2. Raw WebSocket Test Page (`/test/terminal-raw`)

A low-level WebSocket testing tool that bypasses the Shelltender client library.

**Features:**
- Direct WebSocket connection to Shelltender
- Manual control over connect/disconnect
- Raw message logging
- Side-by-side terminal and debug log view
- Tests the WebSocket protocol directly

**Usage:**
1. Navigate to `http://localhost:5173/test/terminal-raw`
2. Click "Connect WebSocket" to establish connection
3. Monitor the debug logs for:
   - Connect message being sent
   - Connect response with scrollback data
   - Output messages
4. Use "Send 'ls -la'" to test command execution
5. Refresh the page and reconnect to test buffer restoration

### 3. DirectTerminalDebug Component

A debug version of the standard DirectTerminal component with WebSocket message interception.

**Features:**
- Logs all WebSocket send/receive messages
- Highlights connect messages with scrollback data
- Reports terminal initialization status
- Can be swapped in place of DirectTerminal for debugging

**Usage:**
```tsx
import { DirectTerminalDebug } from './components/terminal/DirectTerminalDebug';

// Replace DirectTerminal with DirectTerminalDebug
<DirectTerminalDebug
  taskId={taskId}
  dbSessionId={dbSessionId}
  shelltenderSessionId={shelltenderSessionId}
  onSessionStatus={(status) => console.log('Status:', status)}
/>
```

## Common Issues and Solutions

### Terminal appears blank after refresh

**Symptoms:**
- Terminal shows no content after page refresh
- No command history visible
- New commands still work

**Debug steps:**
1. Open browser console
2. Navigate to `/test/terminal-raw`
3. Connect and check if scrollback is in the connect response
4. If scrollback exists but terminal is empty, the issue is in the client
5. If no scrollback, the issue is server-side

**Solution:**
Ensure `useIncrementalUpdates={true}` is set on all Terminal components.

### WebSocket connection issues

**Symptoms:**
- Terminal shows "Connecting to terminal service..."
- Console shows WebSocket errors

**Debug steps:**
1. Check network tab for WebSocket connections
2. Verify the WebSocket URL is correct (`/shelltender-ws`)
3. Check if Shelltender service is running: `docker ps`
4. View Shelltender logs: `docker logs shelltender`

## WebSocket Protocol

The Shelltender WebSocket protocol for v0.6.2:

### Connect Message
```json
{
  "type": "connect",
  "sessionId": "session-id",
  "useIncrementalUpdates": true
}
```

### Connect Response
```json
{
  "type": "connect",
  "sessionId": "session-id",
  "scrollback": "previous terminal output...",
  "lastSequence": 42
}
```

### Input Message
```json
{
  "type": "input",
  "sessionId": "session-id",
  "data": "command\r"
}
```

### Output Message
```json
{
  "type": "output",
  "sessionId": "session-id",
  "data": "command output...",
  "sequence": 43
}
```

## Tips

1. Always check browser console for debug logs when issues occur
2. Use the raw WebSocket test to verify the protocol is working
3. Clear browser storage if terminal state seems corrupted
4. The debug tools are only available in development mode
5. Remember to remove DirectTerminalDebug usage in production