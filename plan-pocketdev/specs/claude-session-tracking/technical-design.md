# Claude Session Tracking Technical Design

## Overview
This document outlines the technical design for implementing Claude session tracking in PocketDev, adhering to existing architectural patterns and conventions identified in the codebase.

## Architecture Overview

### Component Architecture
```
Claude Code ──(SessionStart Hook)──> Backend API ──> Database
                                          ↓
                                    WebSocket Service
                                          ↓
                                    Frontend (Real-time updates)
```

## Database Design

### New Table: `agent_sessions`
```sql
CREATE TABLE agent_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    terminal_session_id INTEGER NOT NULL,
    agent_type TEXT NOT NULL CHECK(agent_type IN ('claude', 'aider', 'codex', 'gemini')),
    agent_session_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON DEFAULT '{}',
    FOREIGN KEY (terminal_session_id) REFERENCES terminal_sessions(id) ON DELETE CASCADE,
    UNIQUE(agent_session_id, agent_type)
);

CREATE INDEX idx_agent_sessions_terminal ON agent_sessions(terminal_session_id);
CREATE INDEX idx_agent_sessions_agent_id ON agent_sessions(agent_session_id);
CREATE INDEX idx_agent_sessions_created ON agent_sessions(created_at);
```

### Modification to `terminal_sessions` Table
```sql
ALTER TABLE terminal_sessions ADD COLUMN current_agent_session_id INTEGER;
ALTER TABLE terminal_sessions ADD FOREIGN KEY (current_agent_session_id) 
    REFERENCES agent_sessions(id) ON DELETE SET NULL;
```

## API Design

### New Endpoint: POST /api/agent-sessions
```javascript
// Route: backend/routes/agentSession.routes.js
POST /api/agent-sessions
Headers:
  Content-Type: application/json
Body:
{
  "terminalSessionId": 123,      // From DB_SESSION_ID env var
  "agentType": "claude",         // Agent type identifier
  "agentSessionId": "sess_abc",  // Claude's session ID
  "metadata": {                  // Optional metadata
    "claudeVersion": "code-20250731",
    "projectContext": "feature/split-views"
  }
}

Response (201 Created):
{
  "id": 456,
  "terminalSessionId": 123,
  "agentType": "claude",
  "agentSessionId": "sess_abc",
  "createdAt": "2025-07-31T12:00:00Z",
  "metadata": {...}
}
```

### Controller Implementation Pattern
```javascript
// backend/controllers/agentSession.controller.js
async function createAgentSession(req, res, next) {
  try {
    const { terminalSessionId, agentType, agentSessionId, metadata = {} } = req.body;
    
    // Validation
    if (!terminalSessionId || !agentType || !agentSessionId) {
      return res.status(400).json({ 
        error: 'Missing required fields: terminalSessionId, agentType, agentSessionId' 
      });
    }
    
    // Verify terminal session exists
    const terminalSession = await req.app.locals.models.terminalSession
      .getById(terminalSessionId);
    if (!terminalSession) {
      return res.status(404).json({ error: 'Terminal session not found' });
    }
    
    // Create agent session
    const agentSession = await req.app.locals.models.agentSession.create({
      terminalSessionId,
      agentType,
      agentSessionId,
      metadata
    });
    
    // Update terminal session's current agent session
    await req.app.locals.models.terminalSession.update(terminalSessionId, {
      current_agent_session_id: agentSession.id
    });
    
    // Broadcast WebSocket event
    req.app.locals.wsService.broadcastToTask(terminalSession.task_id, {
      type: 'agent_session_created',
      data: {
        terminalSessionId,
        agentSession,
        taskId: terminalSession.task_id
      }
    });
    
    res.status(201).json(agentSession);
  } catch (error) {
    next(error);
  }
}
```

## Model Layer Design

### New Model: AgentSessionModel
```javascript
// backend/db/models/agentSession.model.js
export class AgentSessionModel {
  constructor(db) {
    this.db = db;
  }
  
  async create({ terminalSessionId, agentType, agentSessionId, metadata = {} }) {
    const result = await this.db.run(
      `INSERT INTO agent_sessions 
       (terminal_session_id, agent_type, agent_session_id, metadata)
       VALUES (?, ?, ?, ?)`,
      [terminalSessionId, agentType, agentSessionId, JSON.stringify(metadata)]
    );
    
    return this.getById(result.lastID);
  }
  
  async getById(id) {
    const row = await this.db.get(
      'SELECT * FROM agent_sessions WHERE id = ?',
      [id]
    );
    
    if (row) {
      row.metadata = JSON.parse(row.metadata || '{}');
    }
    return row;
  }
  
  async getByTerminalSessionId(terminalSessionId) {
    const rows = await this.db.all(
      'SELECT * FROM agent_sessions WHERE terminal_session_id = ? ORDER BY created_at DESC',
      [terminalSessionId]
    );
    
    return rows.map(row => ({
      ...row,
      metadata: JSON.parse(row.metadata || '{}')
    }));
  }
  
  async getByAgentSessionId(agentSessionId, agentType) {
    const row = await this.db.get(
      'SELECT * FROM agent_sessions WHERE agent_session_id = ? AND agent_type = ?',
      [agentSessionId, agentType]
    );
    
    if (row) {
      row.metadata = JSON.parse(row.metadata || '{}');
    }
    return row;
  }
}
```

## SessionStart Hook Implementation

### Implementation Decision
After analyzing the tradeoffs between JavaScript/Node.js and shell script implementations:
- **Node.js**: ~50-100ms startup overhead, requires dependencies, ~40 lines
- **Shell script**: ~5-10ms startup overhead, no dependencies, ~15-20 lines

**Decision**: Use lightweight shell script to minimize impact on Claude startup time.
The 10-20x reduction in startup overhead outweighs the slightly reduced error handling capabilities.

### Hook Script Location
```bash
# backend/scripts/claude-session-start-hook.sh
#!/bin/bash
```

### Hook Implementation (Shell Script - Chosen Approach)
```bash
#!/bin/bash
# backend/scripts/claude-session-start-hook.sh

# Get required environment variables
TERMINAL_SESSION_ID="${DB_SESSION_ID}"
CLAUDE_SESSION_ID="${CLAUDE_SESSION_ID:-$1}"
API_URL="${POCKETDEV_API_URL:-http://backend:3005}"

# Silent exit if missing required vars (REQ-CST-005)
if [ -z "$TERMINAL_SESSION_ID" ] || [ -z "$CLAUDE_SESSION_ID" ]; then
    exit 0
fi

# Make API call to register session (REQ-CST-011)
curl -s -X POST "${API_URL}/api/agent-sessions" \
    -H "Content-Type: application/json" \
    -d "{
        \"terminalSessionId\": ${TERMINAL_SESSION_ID},
        \"agentType\": \"claude\",
        \"agentSessionId\": \"${CLAUDE_SESSION_ID}\",
        \"metadata\": {
            \"hookVersion\": \"1.0.0\",
            \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
        }
    }" > /dev/null 2>&1

# Always exit successfully to not block Claude (REQ-CST-012)
exit 0
```

### Hook Implementation (Node.js - Original Design for Reference)
```javascript
// backend/scripts/claude-session-start-hook.js
import fetch from 'node-fetch';

async function reportSessionStart() {
  try {
    // Get required environment variables
    const terminalSessionId = process.env.DB_SESSION_ID;
    const claudeSessionId = process.env.CLAUDE_SESSION_ID || process.argv[2];
    const apiUrl = process.env.POCKETDEV_API_URL || 'http://backend:3005';
    
    if (!terminalSessionId || !claudeSessionId) {
      console.error('Missing required environment variables');
      process.exit(0); // Exit gracefully per REQ-CST-005
    }
    
    // Make API call to register session
    const response = await fetch(`${apiUrl}/api/agent-sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        terminalSessionId: parseInt(terminalSessionId),
        agentType: 'claude',
        agentSessionId: claudeSessionId,
        metadata: {
          hookVersion: '1.0.0',
          timestamp: new Date().toISOString()
        }
      })
    });
    
    if (!response.ok) {
      console.error(`API call failed: ${response.status}`);
    }
  } catch (error) {
    // Fail silently per REQ-CST-012
    console.error('Hook error:', error.message);
  }
  
  // Always exit successfully to not block Claude
  process.exit(0);
}

reportSessionStart();
```

### Hook Integration with Claude Launch
```javascript
// Modification to backend/services/terminal.service.js
async launchAIInTerminal(sessionId, taskId, aiType, prompt) {
  // ... existing code ...
  
  // Add hook configuration for Claude
  if (aiType === 'claude') {
    // Set up environment for hook
    envVars.DB_SESSION_ID = dbSessionId;
    envVars.POCKETDEV_API_URL = process.env.BACKEND_URL || 'http://backend:3005';
    
    // Configure Claude to use our SessionStart hook (shell script)
    const hookPath = '/app/scripts/claude-session-start-hook.sh';
    command = `claude --session-start-hook="${hookPath}" ${promptArg}`;
  }
  
  // ... rest of existing code ...
}
```

## WebSocket Integration

### Event Types
```javascript
// backend/utils/websocket.js additions
export const WS_EVENT_TYPES = {
  // ... existing events ...
  AGENT_SESSION_CREATED: 'agent_session_created',
  AGENT_SESSION_UPDATED: 'agent_session_updated'
};
```

### Frontend Integration Points
```typescript
// frontend/src/hooks/useWebSocket.ts
// Add handler for new event type
case 'agent_session_created':
  // Update local state with agent session info
  handleAgentSessionCreated(event.data);
  break;
```

## Migration Strategy

### Migration File: `003_add_agent_sessions.sql`
```sql
-- Add agent_sessions table
CREATE TABLE agent_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    terminal_session_id INTEGER NOT NULL,
    agent_type TEXT NOT NULL CHECK(agent_type IN ('claude', 'aider', 'codex', 'gemini')),
    agent_session_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON DEFAULT '{}',
    FOREIGN KEY (terminal_session_id) REFERENCES terminal_sessions(id) ON DELETE CASCADE,
    UNIQUE(agent_session_id, agent_type)
);

CREATE INDEX idx_agent_sessions_terminal ON agent_sessions(terminal_session_id);
CREATE INDEX idx_agent_sessions_agent_id ON agent_sessions(agent_session_id);
CREATE INDEX idx_agent_sessions_created ON agent_sessions(created_at);

-- Add current_agent_session_id to terminal_sessions
ALTER TABLE terminal_sessions ADD COLUMN current_agent_session_id INTEGER;

-- Migrate existing Claude sessions where detectable
INSERT INTO agent_sessions (terminal_session_id, agent_type, agent_session_id, created_at, metadata)
SELECT 
    id as terminal_session_id,
    'claude' as agent_type,
    'legacy-' || id as agent_session_id,
    created_at,
    json_object('migrated', true, 'migratedAt', datetime('now'))
FROM terminal_sessions
WHERE ai_agent = 'claude' 
  AND ai_state != 'not-started';

-- Update current_agent_session_id for migrated sessions
UPDATE terminal_sessions
SET current_agent_session_id = (
    SELECT id FROM agent_sessions 
    WHERE agent_sessions.terminal_session_id = terminal_sessions.id
    ORDER BY created_at DESC LIMIT 1
)
WHERE ai_agent = 'claude' AND ai_state != 'not-started';
```

## Error Handling Strategy

### API Error Handling
```javascript
// Graceful degradation per REQ-CST-005
// - Log errors but don't block operations
// - Return appropriate HTTP status codes
// - Include error details in response for debugging
```

### Hook Error Handling
```javascript
// Silent failure per REQ-CST-012
// - Catch all exceptions
// - Log to console for debugging
// - Always exit with code 0
// - Never block Claude execution
```

## Testing Considerations

### Unit Tests
- Model layer CRUD operations
- Controller validation logic
- WebSocket event broadcasting
- Migration script execution

### Integration Tests
- Full API flow from hook to database
- WebSocket event delivery
- Error scenarios (missing data, API down)
- Concurrent session handling

### Manual Test Scenarios
1. Launch Claude in terminal and verify session tracking
2. Launch multiple Claude sessions in same terminal
3. Test hook with API service down
4. Verify WebSocket updates in frontend
5. Test migration on existing database

## Security Considerations

### Authentication (Out of Scope)
- Per requirements, no authentication for hook API calls
- Future consideration: API key or JWT token

### Input Validation
- Validate all required fields
- Sanitize metadata JSON
- Prevent SQL injection via prepared statements
- Rate limiting on API endpoint

## Performance Considerations

### Database Indexes
- Index on terminal_session_id for quick lookups
- Index on agent_session_id for uniqueness checks
- Index on created_at for time-based queries

### API Response Time
- Async processing where possible
- Minimal database queries
- Fast-fail validation

### Hook Performance
- Minimal startup overhead
- Short timeout on API calls
- Non-blocking execution

## Rollback Plan

### Database Rollback
```sql
-- Remove foreign key from terminal_sessions
ALTER TABLE terminal_sessions DROP COLUMN current_agent_session_id;

-- Drop agent_sessions table
DROP TABLE IF EXISTS agent_sessions;
```

### Code Rollback
- Remove API endpoint routes
- Remove model files
- Remove hook script
- Revert terminal service changes

## Implementation Order

1. Database migration (schema changes)
2. Model layer implementation
3. API endpoint implementation
4. WebSocket event integration
5. Hook script creation
6. Terminal service integration
7. Frontend updates (if needed)
8. Testing and validation

## Design Decisions and Tradeoffs

### Decision: Separate agent_sessions table vs extending terminal_sessions
- **Choice**: Separate table
- **Rationale**: Supports multiple sessions per terminal, cleaner separation of concerns
- **Tradeoff**: Additional join for queries vs simpler schema

### Decision: Synchronous vs asynchronous hook processing
- **Choice**: Fire-and-forget async with graceful failure
- **Rationale**: Don't block Claude startup, resilient to API issues
- **Tradeoff**: Potential for missed sessions vs guaranteed tracking

### Decision: Generic agent_type field vs Claude-specific design
- **Choice**: Generic design supporting multiple agent types
- **Rationale**: Future extensibility for other AI agents
- **Tradeoff**: Slightly more complex validation vs flexibility

### Decision: JSON metadata field vs structured columns
- **Choice**: JSON metadata field
- **Rationale**: Flexibility for future attributes without schema changes
- **Tradeoff**: Less type safety vs schema flexibility

## Success Metrics

1. Zero impact on Claude startup time
2. 99%+ session capture rate
3. Real-time visibility in UI within 1 second
4. Support for 10+ concurrent sessions per terminal
5. Clean migration of existing data