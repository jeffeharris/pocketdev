# Frontend Stores Design Review

**Review Date**: 2025-08-03  
**Reviewer**: John Ousterhout's Code Detective  
**Files Reviewed**: 
- `/frontend/src/stores/terminalStore.ts`
- `/frontend/src/stores/splitViewStore.ts`
- `/frontend/src/stores/index.ts`

## DESIGN ANALYSIS SUMMARY

The frontend stores exhibit classic symptoms of shallow module design with excessive interface complexity. The `terminalStore` exposes 34 public methods and multiple state maps, while `splitViewStore` has 17 public methods. Both stores violate Ousterhout's principle that modules should be "deep" - simple interfaces hiding significant complexity. The current design forces consumers to understand implementation details like nested Maps, disposal callbacks, and WebSocket event handling, creating high cognitive load and tight coupling throughout the application.

## CRITICAL ISSUES

### 1. Shallow Module Design - Terminal Store
**Principle violated**: Deep modules (simple interface, complex implementation)  
**Problem**: The terminalStore exposes 34 public methods (24 actions + 10 selectors), making it a textbook example of a shallow module. The interface is nearly as complex as the implementation.  
**Impact**: Every component using this store must understand dozens of methods, increasing cognitive load exponentially. New developers must learn 34 different ways to interact with terminals.  
**Recommended fix**: Create a deep module with 5-7 methods maximum:
```typescript
interface TerminalStore {
  // Core operations only
  loadTerminals(taskId: string): Promise<void>;
  selectTerminal(taskId: string, terminalId: string): void;
  updateTerminal(taskId: string, terminalId: string, changes: TerminalUpdate): void;
  
  // Single selector with filtering
  getTerminals(taskId: string, filter?: TerminalFilter): Terminal[];
  
  // Single subscription point
  subscribe(taskId: string, callback: (terminals: Terminal[]) => void): () => void;
}
```

### 2. Leaky Abstraction - Exposed Implementation Details
**Principle violated**: Information hiding  
**Problem**: Both stores expose their internal data structures (Maps) and implementation details (disposal callbacks, loading states, WebSocket handling) directly in the interface.  
**Impact**: Components become tightly coupled to the store's implementation. Changing from Maps to arrays or modifying the disposal mechanism would break every consumer.  
**Recommended fix**: Hide all implementation details behind a clean abstraction:
```typescript
// Bad - exposes implementation
terminals: Map<string, Map<string, Terminal>>;
disposalCallbacks: Map<string, () => void>;

// Good - hides implementation
private state: TerminalState; // Internal structure hidden
getTerminals(taskId: string): Terminal[]; // Clean interface
```

### 3. Mixed Abstraction Levels - WebSocket Handling
**Principle violated**: Different layer, different abstraction  
**Problem**: The `handleTerminalWebSocketEvent` function (lines 359-432) mixes transport-layer concerns (WebSocket events, message parsing) with business logic (terminal state management).  
**Impact**: The store becomes responsible for both state management AND protocol handling, violating single responsibility. WebSocket protocol changes require modifying the store.  
**Recommended fix**: Extract WebSocket handling to a separate adapter layer:
```typescript
// WebSocketAdapter handles protocol details
class TerminalWebSocketAdapter {
  constructor(private store: TerminalStore) {}
  
  handleMessage(event: WebSocketEvent) {
    const terminal = this.parseTerminal(event);
    this.store.updateTerminal(terminal.taskId, terminal.id, terminal);
  }
}
```

## HIGH PRIORITY IMPROVEMENTS

### 1. Redundant ID Management
**Principle violated**: Define errors out of existence  
**Problem**: The system tracks multiple IDs (sessionId, dbSessionId, shelltenderSessionId) for the same conceptual entity, creating confusion and potential mismatches.  
**Impact**: Developers must constantly map between different ID types. The WebSocket handler (lines 374-392) has complex ID mapping logic that compensates for this design flaw.  
**Recommended fix**: Use a single canonical ID throughout the system:
```typescript
interface Terminal {
  id: string; // One ID to rule them all
  taskId: string;
  name: string;
  state: TerminalState;
}
```

### 2. Excessive Granular Methods
**Principle violated**: Pull complexity downward  
**Problem**: The stores expose many fine-grained methods (setActiveTerminal, setFocusedTerminal, setLoading, etc.) instead of cohesive operations.  
**Impact**: Simple operations require multiple method calls, increasing the chance of inconsistent state. Components must orchestrate these low-level operations.  
**Recommended fix**: Provide high-level operations that encapsulate common workflows:
```typescript
// Instead of multiple calls
store.setLoading(taskId, true);
store.setTerminals(taskId, terminals);
store.setActiveTerminal(taskId, terminals[0].id);
store.setLoading(taskId, false);

// Single cohesive operation
await store.loadTerminals(taskId);
```

### 3. Manual State Synchronization
**Principle violated**: Design it twice  
**Problem**: The split view store duplicates terminal selection state (primaryTerminalId, secondaryTerminalId) that must be manually synchronized with the terminal store.  
**Impact**: State can become inconsistent between stores. Deleting a terminal requires updates in multiple places.  
**Recommended fix**: Make split view store observe terminal store state:
```typescript
class SplitViewStore {
  constructor(private terminalStore: TerminalStore) {
    // Automatically sync terminal availability
    terminalStore.subscribe((terminals) => this.validateSelectedTerminals(terminals));
  }
}
```

## MEDIUM PRIORITY SUGGESTIONS

### 1. Console Logging in Production Code
**Principle violated**: Different layer, different abstraction  
**Problem**: Extensive console.log statements throughout the store (lines 89-112, 134, 360-367) mix debugging concerns with business logic.  
**Impact**: Production logs become noisy, performance may degrade, and the code is harder to read.  
**Recommended fix**: Use a proper logging abstraction:
```typescript
class TerminalStore {
  constructor(private logger: Logger) {}
  
  addTerminal(taskId: string, terminal: Terminal) {
    this.logger.debug('Adding terminal', { taskId, terminalId: terminal.id });
    // Business logic without console.logs
  }
}
```

### 2. Implicit Active Terminal Selection
**Principle violated**: Define errors out of existence  
**Problem**: The store automatically selects the first terminal as active when none is selected (lines 82-85, 114-117).  
**Impact**: This implicit behavior is hidden from consumers and may not match user expectations.  
**Recommended fix**: Make active terminal selection explicit:
```typescript
interface TerminalStore {
  loadTerminals(taskId: string, options?: { selectFirst?: boolean }): Promise<void>;
}
```

### 3. Complex Focus Management
**Principle violated**: Pull complexity downward  
**Problem**: The store tracks both "active" and "focused" terminals with separate state and methods.  
**Impact**: Consumers must understand the difference between active and focused, doubling the interface complexity.  
**Recommended fix**: Unify selection state:
```typescript
interface TerminalSelection {
  selected: string | null;  // Currently selected terminal
  viewFocus: string | null; // Terminal with keyboard focus (UI concern)
}
```

## POSITIVE OBSERVATIONS

1. **Type Safety**: Both stores use TypeScript effectively with well-defined interfaces for Terminal and SplitLayoutConfig.

2. **Immer Integration**: The use of Immer for immutable updates prevents accidental state mutations and simplifies complex nested updates.

3. **Comprehensive Test Coverage**: The test files demonstrate thorough testing of edge cases and state transitions.

4. **Zustand Middleware**: Good use of devtools and subscribeWithSelector middleware for debugging and performance optimization.

5. **Sorted Terminal Lists**: The consistent sorting by tabOrder in getTerminals() provides predictable ordering.

## REFACTORING ROADMAP

### Phase 1: Simplify Terminal Store Interface (Week 1)
1. Create a new `TerminalService` class with 5-7 public methods
2. Move all terminal operations into private methods
3. Implement a single `updateTerminals()` method for all state changes
4. Hide the internal Map structure behind the service interface

### Phase 2: Extract WebSocket Adapter (Week 2)
1. Create `TerminalWebSocketAdapter` to handle all WebSocket events
2. Move ID mapping logic into the adapter
3. Have the adapter call simple store methods
4. Remove WebSocket concerns from the store entirely

### Phase 3: Unify ID System (Week 3)
1. Standardize on a single terminal ID throughout the system
2. Create migration utilities for existing data
3. Update all components to use the unified ID
4. Remove ID mapping complexity

### Phase 4: Consolidate Split View Store (Week 4)
1. Make split view store observe terminal store for available terminals
2. Remove duplicate state tracking
3. Reduce interface to layout management only
4. Implement automatic cleanup when terminals are removed

### Phase 5: Create High-Level Operations (Week 5)
1. Implement composite operations like `loadAndSelectTerminals()`
2. Remove fine-grained setters from public interface
3. Create a `TerminalOperations` facade for common workflows
4. Update components to use high-level operations

### Phase 6: Improve Error Handling (Week 6)
1. Design APIs that can't be misused (e.g., can't select non-existent terminal)
2. Remove unnecessary error states
3. Make invalid states unrepresentable in TypeScript
4. Add runtime validation only at system boundaries

This refactoring would reduce the combined public interface from 51 methods to approximately 15-20 well-designed methods across both stores, achieving true deep module design while maintaining all current functionality.