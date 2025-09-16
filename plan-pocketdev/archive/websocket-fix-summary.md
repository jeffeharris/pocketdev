# WebSocket Connection Fix Summary

<!-- Document Metadata
Created: 2025-07-11
Modified: 2025-07-11
Status: ????
-->


## Problem Identified

The WebSocket connection was failing because:

1. **Iframe URL Issue**: The ShelltenderFrame component was loading `shelltender-terminal.html` from `http://localhost:3005` (project-manager service)
2. **Direct Port Connection**: The HTML file was trying to connect directly to `ws://localhost:8080/`
3. **Docker Networking**: In a Docker environment, the browser running on the host cannot directly access container ports without proper routing

## Root Cause

The `shelltender-terminal.html` file was hardcoded to connect to port 8080, which works for host-based development but fails in Docker because:
- The browser runs on the host machine
- Shelltender WebSocket server runs inside a Docker container
- Direct port connections bypass Docker networking and proxies

## Solution Applied

### 1. Updated WebSocket Connection Logic

Modified `frontend-legacy/shelltender-terminal.html` to detect the environment and use the appropriate WebSocket URL:

```javascript
// Determine the WebSocket URL based on how the page is accessed
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
let wsUrl;

// If loaded from Vite dev server (port 5173), use the proxy
if (window.location.port === '5173' || window.parent.location.port === '5173') {
  wsUrl = `${protocol}//${window.location.hostname}:5173/shelltender-ws/`;
} 
// If loaded from project-manager (port 3005), route through Vite proxy
else if (window.location.port === '3005') {
  wsUrl = `${protocol}//${window.location.hostname}:5173/shelltender-ws/`;
}
// Fallback to direct connection (for non-Docker environments)
else {
  const wsPort = window.SHELLTENDER_WS_PORT || 8080;
  wsUrl = `${protocol}//${window.location.hostname}:${wsPort}/`;
}
```

### 2. Added Proxy Configuration

Updated `frontend/vite.config.ts` to proxy the HTML file:

```javascript
'/shelltender-terminal.html': {
  target: 'http://project-manager:3005',
  changeOrigin: true,
},
```

### 3. Updated Iframe Source

Changed `ShelltenderFrame.tsx` to use a proxied URL:

```javascript
const iframeSrc = `/shelltender-terminal.html?task=${taskId}&session=${terminalSessionId}`;
```

## Connection Flow After Fix

```
React App (port 5173)
    |
    v
Iframe loads: /shelltender-terminal.html (proxied through Vite)
    |
    v
shelltender-terminal.html
    |
    v
WebSocket connects to: ws://localhost:5173/shelltender-ws/
    |
    v
Vite proxy forwards to: ws://shelltender:8080/
    |
    v
Shelltender WebSocket Server (in Docker container)
```

## Verification

To verify the fix:

1. Open browser developer tools
2. Navigate to a task with terminal
3. Check Network tab for WebSocket connections
4. Should see successful WebSocket upgrade to `ws://localhost:5173/shelltender-ws/`
5. Check Console for connection logs

## Additional Files Created

Created missing shell scripts required by Dockerfile:
- `/scripts/pocketdev-shell.sh` - Shell wrapper for terminal sessions
- `/scripts/pocketdev-run.sh` - Command execution wrapper

These scripts provide the shell environment for Shelltender terminal sessions.