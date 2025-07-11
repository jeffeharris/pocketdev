# Decoupled Shelltender Architecture

## Overview

The Shelltender terminal service is now decoupled from the Project Manager server, allowing terminal sessions to persist independently of frontend server restarts.

## Architecture

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Project Manager    │────▶│  Shelltender Service │────▶│  Terminal PTYs  │
│  (port 3005)       │ HTTP │  (ports 8080/8081)   │     │  (Claude, etc)  │
└─────────────────────┘     └──────────────────────┘     └─────────────────┘
         │                            │
         └────── WebSocket ───────────┘
```

### Components

1. **Shelltender Service** (`server/shelltender-service.js`)
   - Standalone Node.js process
   - Port 8080: WebSocket for terminal connections
   - Port 8081: HTTP API for session management
   - Manages all terminal sessions with persistence
   - Data stored in `./data/shelltender-sessions/`

2. **Project Manager** (`server/project-manager-db.js`)
   - Express server on port 3005
   - Serves web UI and API
   - Connects to Shelltender via HTTP/WebSocket
   - Can restart without affecting terminal sessions

3. **Client Libraries**
   - `shelltender-client.js` - HTTP API client
   - `shelltender-ws-client.js` - WebSocket client for real-time events

## Running the Services

### Development Mode

```bash
# Start in development mode with hot reloading
make dev

# View logs
make logs
```

### Production Mode

```bash
# Start in production mode
make prod

# Or using docker-compose directly
docker-compose up -d
```

## Environment Variables

### Project Manager
- `PORT` - Server port (default: 3005)
- `SHELLTENDER_API_URL` - Shelltender HTTP API URL (default: http://localhost:8081)
- `SHELLTENDER_WS_URL` - Shelltender WebSocket URL (default: ws://localhost:8080)

### Shelltender Service
- `SHELLTENDER_PORT` - WebSocket port (default: 8080)
- `SHELLTENDER_API_PORT` - HTTP API port (default: 8081)
- `SHELLTENDER_DATA_DIR` - Session data directory (default: ./data/shelltender-sessions)

## API Endpoints

### Shelltender HTTP API (port 8081)

- `GET /health` - Health check
- `POST /sessions` - Create new session
- `GET /sessions` - List all sessions
- `GET /sessions/:id` - Get session info
- `POST /sessions/:id/execute` - Execute command in session
- `DELETE /sessions/:id` - Close session

## Benefits

1. **Session Persistence** - Terminal sessions survive Project Manager restarts
2. **Independent Scaling** - Services can be scaled separately
3. **Clean Architecture** - Clear separation of concerns
4. **Better Reliability** - Frontend updates don't interrupt active work

## Migration Notes

- Existing sessions will be preserved during migration
- WebSocket connections automatically reconnect
- No changes to user workflow or Claude execution
- AI monitoring continues to work via WebSocket events