# BUG-025: Terminal Store Shallow Module Violates Deep Module Principles

## Summary
The terminalStore violates Ousterhout's deep module principles with 34+ public methods, creating a shallow module where the interface complexity nearly matches the implementation complexity. This makes the code harder to understand, maintain, and change.

## Current State
- **File**: `/frontend/src/stores/terminalStore.ts`
- **Problem**: Interface has 34+ public methods for what should be ~8-10 operations
- **Impact**: Every consumer must understand granular CRUD operations instead of higher-level concepts

## Evidence: Shallow Module Interface
```typescript
interface TerminalStoreState {
  // Raw state exposure (5 Maps)
  terminals: Map<string, Map<string, Terminal>>;
  activeTerminals: Map<string, string>;
  focusedTerminals: Map<string, string>;
  loadingStates: Map<string, boolean>;
  disposalCallbacks: Map<string, () => void>;
  
  // 34+ public methods including:
  setTerminals: (taskId: string, terminals: Terminal[]) => void;
  addTerminal: (taskId: string, terminal: Terminal) => void;
  updateTerminal: (taskId: string, dbSessionId: string, updates: Partial<Terminal>) => void;
  removeTerminal: (taskId: string, dbSessionId: string) => void;
  setActiveTerminal: (taskId: string, dbSessionId: string) => void;
  setFocusedTerminal: (taskId: string, dbSessionId: string) => void;
  clearTaskTerminals: (taskId: string) => void;
  setLoading: (taskId: string, loading: boolean) => void;
  registerDisposal: (dbSessionId: string, callback: () => void) => void;
  disposeTerminal: (dbSessionId: string) => void;
  updateTerminalState: (taskId: string, dbSessionId: string, aiState: Terminal['aiState']) => void;
  renameTerminal: (taskId: string, dbSessionId: string, newName: string) => void;
  reorderTerminals: (taskId: string, terminals: Array<{ dbSessionId: string; tabOrder: number }>) => void;
  getTerminals: (taskId: string) => Terminal[];
  getTerminal: (taskId: string, dbSessionId: string) => Terminal | undefined;
  getActiveTerminal: (taskId: string) => Terminal | undefined;
  getActiveTerminalId: (taskId: string) => string | undefined;
  getFocusedTerminal: (taskId: string) => Terminal | undefined;
  getFocusedTerminalId: (taskId: string) => string | undefined;
  isLoading: (taskId: string) => boolean;
  // Plus 8 convenience hooks and WebSocket handler
}
```

## Deep Module Violations
1. **Interface ≈ Implementation**: 34+ methods expose nearly every internal operation
2. **No abstraction**: Raw CRUD operations instead of business concepts
3. **Leaked internals**: Exposes Map structure, disposal callbacks, loading states
4. **Granular operations**: Separate methods for get/set instead of unified operations
5. **Mixed abstractions**: UI lifecycle (disposal) mixed with state management

## Problems Identified
1. **Cognitive overload**: Consumers must learn 34+ methods
2. **Tight coupling**: Changes to internal structure break consumers
3. **Scattered logic**: Business rules spread across multiple method calls
4. **Difficult testing**: Must mock 34+ methods instead of key operations
5. **Inconsistent patterns**: Some operations are atomic, others require coordination

## Proposed Deep Module Interface
Hide complexity behind ~8-10 high-level operations:

```typescript
interface TerminalStore {
  // Task lifecycle (replaces 6 methods)
  initializeTask(taskId: string, terminals: Terminal[]): void;
  disposeTask(taskId: string): void;
  
  // Terminal management (replaces 12 methods)
  updateTerminal(taskId: string, terminalId: string, action: TerminalAction): void;
  
  // State queries (replaces 10 methods)
  getTaskState(taskId: string): TaskTerminalState;
  getActiveTerminal(taskId: string): Terminal | undefined;
  
  // Navigation (replaces 4 methods)
  setActiveTerminal(taskId: string, terminalId: string): void;
  
  // Global operations (replaces 2 methods)
  reset(): void;
  isLoading(taskId: string): boolean;
}

// Hidden complexity in action types
type TerminalAction = 
  | { type: 'create'; config: TerminalConfig }
  | { type: 'update'; updates: Partial<Terminal> }
  | { type: 'remove' }
  | { type: 'rename'; name: string }
  | { type: 'reorder'; order: number }
  | { type: 'state-change'; aiState: Terminal['aiState'] };

// Rich return type encapsulates multiple current getters
interface TaskTerminalState {
  terminals: Terminal[];
  activeTerminal: Terminal | null;
  focusedTerminal: Terminal | null;
  loading: boolean;
}
```

## Benefits of Deep Module Design
- **Simple interface**: 8 methods vs 34+ methods
- **Hidden complexity**: Map structure invisible to consumers
- **Atomic operations**: Actions are complete, not multi-step
- **Business concepts**: Operations match domain language
- **Easy testing**: Mock 8 operations instead of 34+
- **Change resilience**: Can optimize internals without breaking consumers

## Implementation Strategy
1. **Phase 1**: Create action-based updateTerminal() method
2. **Phase 2**: Consolidate getters into getTaskState()
3. **Phase 3**: Hide Map structure behind interface
4. **Phase 4**: Extract disposal logic to separate lifecycle manager
5. **Phase 5**: Migrate consumers to new interface
6. **Phase 6**: Remove old shallow methods

## Comparison: Before vs After
```typescript
// BEFORE (Shallow): 6 method calls for common operation
store.addTerminal(taskId, terminal);
store.setActiveTerminal(taskId, terminal.dbSessionId);
store.setFocusedTerminal(taskId, terminal.dbSessionId);
store.registerDisposal(terminal.dbSessionId, cleanup);
store.setLoading(taskId, false);
const activeTerminal = store.getActiveTerminal(taskId);

// AFTER (Deep): 2 method calls for same operation  
store.updateTerminal(taskId, terminalId, { 
  type: 'create', 
  config: { ...terminalConfig, autoFocus: true } 
});
const state = store.getTaskState(taskId);
```

## Priority: High
This is a foundational pattern affecting all terminal UI components. The shallow interface creates technical debt throughout the frontend.

## Estimated Effort: 3-4 days
- Designing action types and return interfaces
- Implementing new methods while maintaining compatibility
- Migrating 15+ components to new interface
- Removing old methods

## Related Issues
- BUG-020: Terminal Store Exposes Internal Structure
- BUG-017: Session ID consolidation 
- BUG-015: Terminal Panel decomposition
- Part of broader frontend architecture refactoring

## Filed: 2025-08-03