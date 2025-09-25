# WebSocket Connection Issue Diagnosis

<!-- Document Metadata
Created: 2025-07-11
Modified: 2025-07-11
Status: ????
-->


## Current (Broken) Flow

```
React App (port 5173)
    |
    v
iframe loads: http://localhost:3005/shelltender-terminal.html
    |
    v
shelltender-terminal.html (served by project-manager:3005)
    |
    v
Tries to connect WebSocket to: ws://localhost:8080/
    |
    X FAILS - Browser can't reach Docker container port directly
```

## Root Cause

The `shelltender-terminal.html` file is trying to connect directly to port 8080, which works when Shelltender is running on the host, but fails in Docker because:

1. The browser is running on the host machine
2. Port 8080 is exposed from the Docker container, but the hostname resolution is different
3. The WebSocket connection should go through a proxy to handle the Docker networking

## Solutions

### Solution 1: Update shelltender-terminal.html to use proxy (Recommended)

Modify the WebSocket connection in `shelltender-terminal.html` to use the Vite proxy:

```javascript
// Instead of:
const ws = new WebSocket(`${protocol}//${window.location.hostname}:${wsPort}/`);

// Use:
const ws = new WebSocket(`${protocol}//${window.location.hostname}:5173/shelltender-ws/`);
```

This will route through Vite's proxy configuration which properly handles the Docker networking.

### Solution 2: Serve shelltender-terminal.html from Vite

Move the HTML file to be served by Vite instead of project-manager, so it inherits the same origin and proxy settings.

### Solution 3: Use environment-aware configuration

Make the WebSocket URL configurable based on the environment:

```javascript
const wsUrl = window.SHELLTENDER_WS_URL || 
              (window.location.hostname === 'localhost' ? 
                'ws://localhost:5173/shelltender-ws/' : 
                `${protocol}//${window.location.hostname}:${wsPort}/`);
```

## Verification Steps

1. Check browser console for WebSocket errors
2. Check network tab for failed WebSocket upgrade requests
3. Verify proxy is working: `curl http://localhost:5173/shelltender-ws/` should reach Shelltender
4. Check Docker network connectivity between containers

## Temporary Workaround

If running locally, you can expose Shelltender directly:
```bash
docker run -p 8080:8080 shelltender
```

But this defeats the purpose of the Docker composition and won't work in production.