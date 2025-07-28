# Session Management Technical Design

## Overview
This document describes the technical design for implementing proper Shelltender session management, tab persistence, and renaming functionality based on the requirements defined in `session-management-requirements.md`.

## Architecture Changes

### 1. Session Identifier Strategy

#### Current State
```javascript
// Backend: Creates new session every time
const sessionId = `task-${taskId}-${Date.now()}`;
```

#### New Design
```javascript
// Backend: Use stable database session ID
const shelltenderSessionId = `task-${taskId}-${dbSessionId}`;
```

**Key Points:**
- Database `terminal_sessions.id` becomes the stable identifier
- Shelltender session ID follows predictable format
- Enables reconnection by ID lookup

### 2. Database Schema

#### Current Schema (No changes needed)
```sql
-- terminal_sessions table already has required fields:
CREATE TABLE terminal_sessions (
    id TEXT PRIMARY KEY,              -- Stable DB session ID
    task_id TEXT NOT NULL,
    session_id TEXT,                  -- Shelltender session ID
    shelltender_session_id TEXT,      -- Redundant, can be consolidated
    tab_name TEXT DEFAULT 'Tab 1',
    tab_order INTEGER DEFAULT 0,
    ai_agent TEXT DEFAULT 'claude',
    is_active INTEGER DEFAULT 1,
    -- ... other fields
);
```

**Migration Notes:**
- Consolidate `session_id` and `shelltender_session_id` fields
- Add index on `task_id` + `is_active` for faster queries

### 3. API Endpoints

#### Modified Endpoints

**POST /api/tasks/:taskId/terminals**
```typescript
interface CreateTerminalRequest {
  tabName?: string;
  aiAgent?: string;
  initialPrompt?: string;
  workingDirectory?: string;
  copyHistoryFrom?: string;
}

interface CreateTerminalResponse {
  dbSessionId: string;           // Database session ID
  shelltenderSessionId: string;  // Shelltender session ID
  tabName: string;
  tabOrder: number;
  aiAgent: string;
  isReconnected: boolean;        // True if reconnected to existing
}
```

**GET /api/tasks/:taskId/terminals**
```typescript
interface TerminalSession {
  dbSessionId: string;
  shelltenderSessionId: string;
  tabName: string;
  tabOrder: number;
  aiAgent: string;
  aiState: string;
  isActive: boolean;
  shelltenderStatus: 'active' | 'inactive' | 'not-found';
}
```

**PUT /api/terminals/:dbSessionId**
```typescript
interface UpdateTerminalRequest {
  tabName?: string;
  tabOrder?: number;
}
```

**DELETE /api/terminals/:dbSessionId**
```typescript
// Terminates Shelltender session and marks DB record inactive
```

### 4. Backend Implementation

#### Session Creation Flow
```javascript
// controllers/terminal.controller.js
export async function createTerminalSession(req, res, next) {
  const { taskId } = req.params;
  const { tabName, aiAgent, initialPrompt, workingDirectory } = req.body;
  
  // 1. Create database record first
  const dbSession = await models.sessions.create(taskId, {
    tabName: tabName || `Tab ${tabCount + 1}`,
    aiAgent: aiAgent || 'claude',
    metadata: { initialPrompt, workingDirectory }
  });
  
  // 2. Generate stable Shelltender session ID
  const shelltenderSessionId = `task-${taskId}-${dbSession.id}`;
  
  // 3. Check if Shelltender session exists
  const existingSession = await checkShelltenderSession(shelltenderSessionId);
  
  if (existingSession && existingSession.status === 'active') {
    // 4a. Reconnect to existing session
    await models.sessions.update(dbSession.id, {
      shelltender_session_id: shelltenderSessionId,
      is_active: 1
    });
    
    return res.json({
      dbSessionId: dbSession.id,
      shelltenderSessionId: shelltenderSessionId,
      tabName: dbSession.tab_name,
      tabOrder: dbSession.tab_order,
      aiAgent: dbSession.ai_agent,
      isReconnected: true
    });
  }
  
  // 4b. Create new Shelltender session
  const shelltenderUrl = process.env.SHELLTENDER_API_URL || 'http://shelltender:8080';
  const createResponse = await fetch(`${shelltenderUrl}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: shelltenderSessionId,  // Use our stable ID
      command: '/bin/bash',
      args: ['--login', '-i'],
      cwd: workingDirectory || task.worktree_path,
      env: {
        TASK_ID: taskId,
        DB_SESSION_ID: dbSession.id,
        // ... other env vars
      },
      metadata: {
        taskId,
        dbSessionId: dbSession.id,
        tabName: dbSession.tab_name,
        aiAgent: dbSession.ai_agent
      }
    })
  });
  
  // 5. Update database with Shelltender session ID
  await models.sessions.update(dbSession.id, {
    shelltender_session_id: shelltenderSessionId
  });
  
  return res.json({
    dbSessionId: dbSession.id,
    shelltenderSessionId: shelltenderSessionId,
    tabName: dbSession.tab_name,
    tabOrder: dbSession.tab_order,
    aiAgent: dbSession.ai_agent,
    isReconnected: false
  });
}

// Helper function to check Shelltender session
async function checkShelltenderSession(sessionId) {
  try {
    const response = await fetch(`${SHELLTENDER_URL}/api/sessions/${sessionId}`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    return null;
  }
}
```

#### Tab Loading Flow
```javascript
// controllers/task.controller.js
export async function getTask(req, res, next) {
  const task = await models.tasks.findById(req.params.taskId);
  
  // Get all active terminal sessions
  const terminals = await models.sessions.findAllActiveByTaskId(task.id);
  
  // Check Shelltender status for each terminal
  const terminalsWithStatus = await Promise.all(
    terminals.map(async (terminal) => {
      const shelltenderStatus = await checkShelltenderSession(
        terminal.shelltender_session_id
      );
      return {
        ...terminal,
        shelltenderStatus: shelltenderStatus ? 'active' : 'not-found'
      };
    })
  );
  
  res.json({
    ...task,
    terminals: terminalsWithStatus
  });
}
```

### 5. Frontend Implementation

#### DirectTerminal Component Changes
```typescript
// components/terminal/DirectTerminal.tsx
interface DirectTerminalProps {
  taskId: string;
  dbSessionId: string;          // New: stable DB session ID
  shelltenderSessionId: string; // New: actual Shelltender ID
  className?: string;
  worktreePath?: string;
  isVisible?: boolean;
  onSessionStatus?: (status: 'connected' | 'disconnected' | 'error') => void;
}

const DirectTerminal = ({ 
  taskId, 
  dbSessionId,
  shelltenderSessionId,
  onSessionStatus,
  ...props 
}) => {
  const { isConnected, wsService } = useWebSocket();
  
  // Use Shelltender session ID for connection
  return (
    <Terminal
      sessionId={shelltenderSessionId}
      onSessionCreated={(sessionId) => {
        console.log('Connected to session:', sessionId);
        onSessionStatus?.('connected');
      }}
      onSessionError={(error) => {
        console.error('Session error:', error);
        onSessionStatus?.('error');
      }}
    />
  );
};
```

#### TerminalPanel Component Changes
```typescript
// components/terminal/TerminalPanel.tsx
const TerminalPanel = ({ task }) => {
  const [terminals, setTerminals] = useState<TerminalSession[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  
  // Load terminals on mount
  useEffect(() => {
    const loadTerminals = async () => {
      // Terminals now come from task.terminals with persistence
      if (task.terminals && task.terminals.length > 0) {
        setTerminals(task.terminals);
        
        // Restore active tab from localStorage or use first
        const savedActiveTab = localStorage.getItem(`activeTab-${task.id}`);
        const activeTab = task.terminals.find(t => t.dbSessionId === savedActiveTab) 
          || task.terminals[0];
        
        setActiveTabId(activeTab.dbSessionId);
      } else {
        // Create first terminal if none exist
        await createInitialTerminal();
      }
    };
    
    loadTerminals();
  }, [task.id]);
  
  // Save active tab to localStorage
  useEffect(() => {
    if (activeTabId) {
      localStorage.setItem(`activeTab-${task.id}`, activeTabId);
    }
  }, [activeTabId, task.id]);
  
  const handleTabAdd = async (options?: SessionOptions) => {
    const response = await api.createTerminalSession(task.id, {
      tabName: options?.tabName || `Tab ${terminals.length + 1}`,
      aiAgent: options?.aiAgent || 'claude',
      initialPrompt: options?.initialPrompt,
      workingDirectory: options?.workingDirectory
    });
    
    const newTerminal: TerminalSession = {
      dbSessionId: response.dbSessionId,
      shelltenderSessionId: response.shelltenderSessionId,
      tabName: response.tabName,
      tabOrder: response.tabOrder,
      aiAgent: response.aiAgent,
      aiState: 'not-started',
      isReconnected: response.isReconnected
    };
    
    setTerminals(prev => [...prev, newTerminal]);
    setActiveTabId(newTerminal.dbSessionId);
    
    // Show notification if reconnected
    if (response.isReconnected) {
      toast.info(`Reconnected to existing session: ${response.tabName}`);
    }
  };
  
  const handleSessionStatus = (dbSessionId: string, status: string) => {
    if (status === 'error') {
      // Offer to create new session
      const terminal = terminals.find(t => t.dbSessionId === dbSessionId);
      if (terminal) {
        toast.error(`Session lost for ${terminal.tabName}. Recreating...`);
        // Trigger session recreation
        recreateSession(dbSessionId);
      }
    }
  };
  
  return (
    <>
      <TerminalTabs
        tabs={terminals}
        activeTabId={activeTabId}
        onTabSelect={setActiveTabId}
        onTabAdd={handleTabAdd}
        onTabRename={handleTabRename}
        onTabClose={handleTabClose}
      />
      
      {terminals.map(terminal => (
        <DirectTerminal
          key={terminal.dbSessionId}
          taskId={task.id}
          dbSessionId={terminal.dbSessionId}
          shelltenderSessionId={terminal.shelltenderSessionId}
          isVisible={terminal.dbSessionId === activeTabId}
          onSessionStatus={(status) => handleSessionStatus(terminal.dbSessionId, status)}
        />
      ))}
    </>
  );
};
```

#### Tab Renaming Implementation
```typescript
// components/terminal/TerminalTabs.tsx
export const TerminalTabs: React.FC<TerminalTabsProps> = ({
  tabs,
  onTabRename,
  ...props
}) => {
  const [editingTab, setEditingTab] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  
  const handleDoubleClick = (tab: Tab) => {
    setEditingTab(tab.dbSessionId);
    setEditValue(tab.tabName);
  };
  
  const handleRenameSubmit = async (dbSessionId: string) => {
    if (editValue.trim() && editValue !== tab.tabName) {
      await onTabRename(dbSessionId, editValue.trim());
    }
    setEditingTab(null);
  };
  
  return (
    <div className="flex items-center bg-gray-800 border-b border-gray-700">
      {sortedTabs.map((tab) => (
        <div
          key={tab.dbSessionId}
          onDoubleClick={() => handleDoubleClick(tab)}
          className={tabClassName}
        >
          {editingTab === tab.dbSessionId ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => handleRenameSubmit(tab.dbSessionId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit(tab.dbSessionId);
                if (e.key === 'Escape') setEditingTab(null);
              }}
              className="bg-transparent border-b border-gray-400 outline-none"
              autoFocus
            />
          ) : (
            <span>{tab.tabName}</span>
          )}
        </div>
      ))}
    </div>
  );
};
```

### 6. WebSocket Events

#### New Events
```typescript
// Backend WebSocket broadcasts
io.emit('terminal-tab-renamed', {
  taskId: string,
  dbSessionId: string,
  newName: string
});

io.emit('terminal-session-status', {
  taskId: string,
  dbSessionId: string,
  status: 'connected' | 'disconnected' | 'recreated'
});
```

### 7. Session Cleanup

#### Cleanup Service
```javascript
// services/session-cleanup.service.js
export class SessionCleanupService {
  async cleanupOrphanedSessions() {
    // Get all active Shelltender sessions
    const shelltenderSessions = await listSessions();
    
    // Get all active database sessions
    const dbSessions = await models.sessions.findAllActive();
    
    // Find orphaned Shelltender sessions
    const dbSessionIds = new Set(
      dbSessions.map(s => s.shelltender_session_id)
    );
    
    const orphaned = shelltenderSessions.filter(
      s => !dbSessionIds.has(s.id)
    );
    
    // Terminate orphaned sessions
    for (const session of orphaned) {
      await terminateShelltenderSession(session.id);
      console.log(`Cleaned up orphaned session: ${session.id}`);
    }
    
    return orphaned.length;
  }
}

// Run cleanup on startup and periodically
const cleanup = new SessionCleanupService();
setInterval(() => cleanup.cleanupOrphanedSessions(), 300000); // Every 5 minutes
```

## Migration Strategy

### Phase 1: Implement Stable Session IDs
1. Update backend to generate stable IDs
2. Check for existing sessions before creating new ones
3. Update frontend to use new session ID format

### Phase 2: Add Tab Persistence
1. Ensure tabs are loaded from database on page load
2. Implement localStorage for active tab selection
3. Test session reconnection

### Phase 3: Add Tab Renaming
1. Implement double-click to edit
2. Add API endpoint for updating tab names
3. Add WebSocket broadcast for real-time updates

### Phase 4: Cleanup
1. Implement orphaned session cleanup
2. Add session health monitoring
3. Handle edge cases (lost connections, etc.)

## Testing Strategy

### Unit Tests
- Session ID generation
- Session reconnection logic
- Tab renaming validation

### Integration Tests
- Full session lifecycle (create, reconnect, terminate)
- Tab persistence across page reloads
- Multi-user tab renaming

### Manual Testing
- Verify session count reduction
- Test various failure scenarios
- Validate user experience improvements

## Performance Considerations

- Session checks are async and parallelized
- Cleanup runs in background
- Tab state cached in localStorage
- Minimal API calls for session status

## Security Considerations

- Session IDs include task ID for access control
- Tab names sanitized to prevent XSS
- Session cleanup respects task boundaries
- No cross-task session access