# PocketDev Tech Debt Tracker

This document tracks technical debt items that should be addressed in future iterations.

## AI Session Monitoring (Shelltender v0.6.1)

**Date Added:** 2025-07-18  
**Priority:** Medium  
**Component:** Backend/Monitoring

### Current Issues

1. **Error Handling & Resilience**
   - Session monitor silently retries connections every 5 seconds
   - Should implement exponential backoff and max retry limits
   - No alerts when connections fail repeatedly

2. **Debug Logging**
   - Remove `[DEBUG] Output from...` logging in production (line 54 of shelltender-session-monitor.js)
   - Add proper log levels and configuration

3. **Session Lifecycle Management**
   - When tasks are deleted/completed, WebSocket connections aren't explicitly closed
   - Could lead to resource leaks with many completed tasks
   - Need to hook into task deletion events

4. **Connection Scaling**
   - Each task opens its own WebSocket connection
   - Could be resource-intensive with many concurrent tasks
   - Consider connection pooling or batching

5. **Monitoring & Metrics**
   - No visibility into connection health
   - No metrics for pattern match performance
   - No tracking of message rates or failures

6. **Architecture Documentation**
   - The switch from global monitoring to per-session connections is a significant change
   - Need to document why v0.6.1 requires this approach
   - Migration guide for future Shelltender updates

### Proposed Solutions

1. **Implement connection manager with:**
   - Exponential backoff (1s, 2s, 4s, 8s, max 30s)
   - Max retry limit (10 attempts)
   - Alert mechanism after max retries

2. **Add proper logging:**
   ```javascript
   const logger = createLogger({ level: process.env.LOG_LEVEL || 'info' });
   ```

3. **Hook into task lifecycle:**
   ```javascript
   wsEventService.on('task-deleted', (taskId) => {
     sessionMonitor.closeSession(`task-${taskId}`);
   });
   ```

4. **Connection pooling research:**
   - Investigate if Shelltender v0.7+ will support multiplexing
   - Consider implementing a connection limit (max 50 concurrent)

5. **Add monitoring dashboard:**
   - Connection status per task
   - Message rates and pattern matches/second
   - Failed connection attempts

### Impact
- **Performance:** Medium - Resource usage scales with task count
- **Reliability:** High - Silent failures could miss AI state updates
- **Maintainability:** Medium - Current implementation is straightforward but fragile

### References
- Original issue investigation: Backend monitoring broke after Shelltender v0.6.1 upgrade
- New implementation: `/backend/shelltender-session-monitor.js`
- Documentation: `/docs/shelltender/MONITORING_v0.6.1.md`

## Session Management & Multi-Terminal Tabs

**Date Added:** 2025-07-23  
**Priority:** High  
**Component:** Backend/Frontend Terminal Management

### Current Issues

1. **Session ID Proliferation**
   - Three different session ID fields: sessionId, dbSessionId, shelltenderSessionId
   - Database has both session_id and shelltender_session_id columns with same values
   - Frontend components inconsistently use different IDs
   - Impact: Confusion, bugs, and maintenance overhead

2. **Massive Session Accumulation (FIXED)**
   - Previous implementation created new Shelltender sessions on every tab/page refresh
   - Task 3d36b64f had accumulated 68 database sessions and counting
   - System had 80+ active Shelltender sessions
   - **Status:** Fixed with stable session IDs in current branch

3. **Tab Persistence Not Implemented** ✅ FIXED
   - ~~Tabs don't persist across page reloads (requirement violation)~~
   - ~~Active tab selection not saved~~
   - ~~Users lose their multi-terminal setup on refresh~~
   - ~~Impact: Poor user experience~~
   - **Status:** Fixed in feature/multi-terminal-tabs branch

4. **Missing Tab Management Features**
   - No tab renaming (double-click to edit)
   - No tab reordering (drag and drop)
   - No keyboard shortcuts for tab switching
   - No close tab functionality

5. **Session Error Handling**
   - No user notifications when sessions disconnect
   - TODOs left in handleSessionStatus
   - No automatic reconnection attempts
   - Silent failures leave users confused

6. **Frontend Type Safety Issues**
   - Multiple `@typescript-eslint/no-explicit-any` violations
   - Inconsistent typing for session objects
   - Missing proper types for API responses

### Proposed Solutions

1. **Consolidate Session IDs:**
   ```typescript
   interface TerminalSession {
     id: string;              // Database ID, primary identifier
     sessionId: string;       // Shelltender session ID
     // Remove redundant fields
   }
   ```

2. **Implement Tab Persistence:**
   - Store active terminals in database (already done)
   - Save active tab to localStorage
   - Restore on component mount

3. **Add Missing Features:**
   - Tab renaming with inline editing
   - Tab close with confirmation
   - Keyboard shortcuts (Ctrl+1-6 for tabs)
   - Status aggregation for task-level state

4. **Improve Error Handling:**
   - Add toast notifications for errors
   - Implement reconnection with exponential backoff
   - Show connection status in UI

### Impact
- **User Experience:** High - Core feature incomplete
- **Data Integrity:** Medium - Session accumulation wastes resources
- **Code Quality:** Medium - Type safety and consistency issues

### References
- Requirements: `/.pocketdev/specs/multi-terminal-tabs/requirements.md`
- Design: `/.pocketdev/specs/multi-terminal-tabs/technical-design.md`
- Implementation: Current branch `fix/session-management-and-tab-persistence`

## Frontend Terminal Session State Management

**Date Added:** 2025-07-28  
**Priority:** High  
**Component:** Frontend State Management

### Current Issues

1. **Duplicated State Aggregation Logic**
   - Same priority calculation logic exists in both `TaskListItem.tsx` and `TaskStatus.tsx`
   - Each component independently calculates which session has highest priority
   - Violates DRY principle and risks inconsistencies

2. **Complex Prop Drilling**
   - Session states passed through multiple component layers
   - `TaskWorkspace` → `Sidebar` → `TaskListItem` → `TaskStatus`
   - Makes components tightly coupled and hard to maintain

3. **Multiple State Formats**
   - Converting between `task.terminals`, `sessionStates`, and `taskSessionStates`
   - Each component handles format conversions differently
   - Increases complexity and potential for bugs

4. **Hacky State Communication**
   - Using `sessionStorage` to pass focus tab IDs between components
   - Components can't easily access terminal state when needed
   - Leading to workarounds like storing data in DOM or sessionStorage

5. **Mixed Responsibilities**
   - Components both display AND calculate aggregated states
   - Business logic mixed with presentation logic
   - Makes testing and refactoring difficult

### Impact
- **Code Quality:** High - Significant duplication and complexity
- **Maintainability:** High - Changes require updates in multiple places
- **Bug Risk:** High - Easy to introduce inconsistencies
- **Performance:** Medium - Redundant calculations in multiple components

### Proposed Solution

Implement a global state management solution for terminal sessions:

1. **Create a Terminal Session Store** (using Zustand or Context API)
   ```typescript
   interface TerminalSessionStore {
     // Session states by task ID
     sessionStates: Map<string, TerminalSessionState[]>;
     
     // Aggregated states (cached)
     aggregatedStates: Map<string, AggregatedState>;
     
     // Actions
     updateSessionState: (taskId: string, sessions: TerminalSessionState[]) => void;
     getAggregatedState: (taskId: string) => AggregatedState;
     getHighestPrioritySession: (taskId: string) => string | undefined;
   }
   ```

2. **Centralize Business Logic**
   - Move all priority calculations to the store
   - Single source of truth for aggregation logic
   - Memoize aggregated states for performance

3. **Simplify Components**
   - Components just read from store
   - Remove prop drilling for session states
   - Focus on presentation, not calculation

4. **WebSocket Integration**
   - Store subscribes to WebSocket updates
   - Automatic state updates across all components
   - No manual prop passing needed

### Benefits
- Single source of truth for terminal session states
- Eliminates code duplication
- Easier to test business logic in isolation
- Components become simpler and more focused
- Better performance through memoization
- Easier to add new features (like session filtering)

### References
- Current implementation shows issues in:
  - `/frontend/src/components/task/TaskListItem.tsx`
  - `/frontend/src/components/task/TaskStatus.tsx`
  - `/frontend/src/hooks/useTaskStatus.ts`
- Similar pattern could benefit AI state tracking across the app