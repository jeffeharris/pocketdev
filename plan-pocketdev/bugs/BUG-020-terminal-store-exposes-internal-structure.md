# BUG-020: Terminal Store Exposes Internal Structure

<!-- Document Metadata
Created: 2025-08-01
Modified: 2025-08-01
Status: ????
-->


## Summary
The terminal store in the frontend exposes its nested Map implementation details and includes 30+ methods in its interface. This violates information hiding and creates a shallow module with high cognitive load.

## Current State
- **File**: `/frontend/src/stores/terminalStore.ts`
- **Problem**: Exposes Map<taskId, Map<dbSessionId, Terminal>> structure
- **Impact**: Every consumer must understand internal data structure

## Evidence
```typescript
// Current implementation exposes nested Maps:
interface TerminalStore {
  terminals: Map<string, Map<string, Terminal>>;
  activeTerminals: Map<string, string>;
  focusedTerminals: Map<string, string>;
  disposalCallbacks: Map<string, () => void>; // UI concern in state!
  
  // 30+ methods including:
  addTerminal(taskId: string, terminal: Terminal): void;
  removeTerminal(taskId: string, dbSessionId: string): void;
  getTerminal(taskId: string, dbSessionId: string): Terminal | undefined;
  // ... many more
}
```

## Problems Identified
1. **Leaky abstraction**: Nested Map structure exposed
2. **Shallow interface**: 30+ methods for basic CRUD operations
3. **Mixed concerns**: Disposal callbacks (UI lifecycle) in state management
4. **Redundant state**: Multiple Maps tracking active/focused state
5. **Manual synchronization**: Components must coordinate with splitViewStore

## Proposed Solution
Create a deep module that hides implementation:

```typescript
interface TerminalStore {
  // Simple interface hiding complexity
  getTaskTerminals(taskId: string): Terminal[];
  getActiveTerminal(taskId: string): Terminal | null;
  
  // High-level operations
  createTerminal(taskId: string, config: TerminalConfig): Terminal;
  updateTerminalState(taskId: string, terminalId: string, state: Partial<Terminal>): void;
  removeTerminal(taskId: string, terminalId: string): void;
  
  // Single source of truth for focus
  setFocus(taskId: string, terminalId: string): void;
  getFocusedTerminal(taskId: string): Terminal | null;
}

// Move lifecycle management out
class TerminalLifecycleManager {
  registerDisposal(terminalId: string, callback: () => void): void;
  dispose(terminalId: string): void;
}
```

## Implementation Steps
1. Hide Map implementation behind cleaner API
2. Extract disposal callbacks to lifecycle manager
3. Consolidate active/focused state into Terminal objects
4. Reduce public methods from 30+ to ~10
5. Create facade for cross-store operations
6. Add proper encapsulation tests

## Benefits
- **Information hiding**: Implementation details invisible
- **Reduced cognitive load**: Simpler interface to understand
- **Better separation**: UI lifecycle separate from state
- **Single responsibility**: Store only manages state
- **Easier testing**: Can change implementation without breaking consumers

## Priority: High
Central to terminal management functionality. The exposed complexity affects every component using terminals.

## Estimated Effort: 2-3 days

## Related
- Similar to session ID proliferation (BUG-017)
- Part of frontend state management complexity
- Affects terminal components throughout UI

## Filed: 2025-08-01