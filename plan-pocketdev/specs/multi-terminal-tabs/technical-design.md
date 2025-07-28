# Multi-Terminal Tabs Technical Design

## Architecture Overview

### Component Structure
```
TaskWorkspace
  └── TerminalPanel
       ├── TerminalTabs (new)
       │    ├── Tab
       │    ├── AddTabButton
       │    └── TabContextMenu
       ├── TerminalContainer (new)
       │    └── DirectTerminal[] (multiple instances)
       └── SessionLauncher (new modal)
```

### Data Flow
1. User clicks "+" → SessionLauncher modal or quick create
2. Backend creates Shelltender session → Returns session ID
3. Frontend adds tab to state → Renders new DirectTerminal
4. AI monitor detects state changes → Updates via WebSocket
5. Frontend aggregates states → Updates TaskStatus display

## Implementation Plan

### Phase 1: Backend Infrastructure
1. **Database Schema Updates**
   - Add columns: tab_name, tab_order, ai_session_id, ai_agent
   - Remove is_active unique constraint
   - Migration script for existing data

2. **API Enhancements**
   - New endpoint for session creation with options
   - Tab management endpoints (rename, reorder, close)
   - Modify terminal controller for multi-session support

3. **Session Management**
   - Update AI state tracker for per-session tracking
   - Enhance WebSocket events with session identifiers
   - Modify session.js to handle multiple active sessions

### Phase 2: Frontend Tab System
1. **TerminalTabs Component**
   ```typescript
   interface Tab {
     sessionId: string;
     tabName: string;
     tabOrder: number;
     aiState: AIState;
     aiAgent: AIAgent;
   }
   ```

2. **State Management**
   - Store tabs in TaskWorkspace state
   - Handle tab CRUD operations
   - Persist tab state to backend

3. **Terminal Instance Management**
   - Create DirectTerminal instances on demand
   - Implement terminal virtualization for performance
   - Handle focus management between terminals

### Phase 3: Advanced Features
1. **Quick Launch**
   - One-click Claude session creation
   - Auto-execute `claude` command after terminal ready

2. **Session Launcher Modal**
   - AI agent selection dropdown
   - Working directory browser
   - Initial prompt textarea
   - Template selection

3. **Initial Prompt Execution**
   - Send commands via WebSocket after session ready
   - Handle multi-line prompts for Claude
   - Store session IDs for correlation

## Key Implementation Details

### Terminal Command Execution
```javascript
// Quick launch Claude with initial prompt
async function launchClaudeSession(sessionId, initialPrompt) {
  // Wait for terminal ready
  await waitForTerminalReady(sessionId);
  
  // Send claude command with prompt
  const command = initialPrompt 
    ? `claude "${initialPrompt.replace(/"/g, '\\"')}"\n`
    : 'claude\n';
  
  sendToTerminal(sessionId, command);
}
```

### State Aggregation Logic
```javascript
function getAggregateState(sessions) {
  // Priority order: waiting > working > idle > not-started
  if (sessions.some(s => s.aiState === 'waiting')) return 'waiting';
  if (sessions.some(s => s.aiState === 'working')) return 'working';
  if (sessions.some(s => s.aiState === 'idle')) return 'idle';
  return 'not-started';
}
```

### Tab Persistence
```javascript
// Store tab configuration
interface TabConfig {
  sessionId: string;
  tabName: string;
  tabOrder: number;
  aiAgent: string;
  workingDirectory?: string;
  createdAt: Date;
}

// Restore tabs on mount
useEffect(() => {
  const savedTabs = await api.getTaskTerminals(taskId);
  setTabs(savedTabs.sort((a, b) => a.tabOrder - b.tabOrder));
}, [taskId]);
```

## Migration Strategy

1. **Existing Sessions**
   - Current single sessions become "Tab 1"
   - Maintain backward compatibility
   - No disruption to active sessions

2. **Feature Flag**
   - Roll out behind feature flag
   - Test with subset of users
   - Gradual rollout

3. **Database Migration**
   ```sql
   -- Add default values for existing sessions
   UPDATE terminal_sessions 
   SET tab_name = 'Main',
       tab_order = 0,
       ai_agent = 'claude'
   WHERE tab_name IS NULL;
   ```

## Testing Considerations

1. **Unit Tests**
   - Tab state management
   - Status aggregation logic
   - Session creation with options

2. **Integration Tests**
   - Multi-session creation
   - Tab persistence across reloads
   - WebSocket event handling

3. **E2E Tests**
   - Full flow from creation to AI interaction
   - Tab switching and focus management
   - Edge cases (max tabs, session failures)

## Performance Optimizations

1. **Lazy Terminal Loading**
   - Create terminal instance only when tab activated
   - Destroy terminal instances for closed tabs
   - Virtualize inactive terminals

2. **WebSocket Optimization**
   - Batch state updates
   - Throttle rapid state changes
   - Efficient event routing

3. **Memory Management**
   - Limit terminal output buffer
   - Clear old session data
   - Monitor memory usage

## Security Considerations

1. **Session Isolation**
   - Each session has independent PTY
   - No shared state between sessions
   - Maintain Shelltender restrictions

2. **Command Injection**
   - Sanitize initial prompts
   - Escape special characters
   - Validate AI agent selection

3. **Resource Limits**
   - Enforce 6 tab maximum
   - Monitor resource usage
   - Graceful degradation

## Known Challenges

1. **Terminal Focus Management**
   - xterm.js focus handling across instances
   - Keyboard shortcut conflicts
   - Tab switching responsiveness

2. **State Synchronization**
   - Multiple WebSocket connections
   - Race conditions in state updates
   - Consistency across browser tabs

3. **AI Session Correlation**
   - Claude doesn't expose session IDs via CLI
   - Need to parse output or use SDK
   - Handle session resumption