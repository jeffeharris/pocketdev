# BUG-026: Split View Store Shallow Module

## Summary
The splitViewStore exposes 17 public methods for what should be simple view state management. It mixes layout control, terminal assignment, UI state, and network operations in a single interface, creating a shallow module that violates information hiding principles.

## Current State
- **File**: `/frontend/src/stores/splitViewStore.ts`
- **Problem**: 17 public methods with mixed abstraction levels
- **Impact**: Complex interface that's hard to use correctly and maintain

## Evidence
```typescript
// Current interface exposes too many granular operations:
interface SplitViewState {
  // Layout operations (should be high-level)
  updateLayout: (changes: Partial<SplitLayoutConfig>) => void;
  toggleSplitMode: () => void;
  cycleSplitMode: () => void;
  setSplitRatio: (ratio: number) => void;
  swapPanes: () => void;
  
  // Individual terminal assignment (too granular)
  setPrimaryTerminal: (terminalId: string | null) => void;
  setSecondaryTerminal: (terminalId: string | null) => void;
  setTertiaryTerminal: (terminalId: string | null) => void;
  setQuaternaryTerminal: (terminalId: string | null) => void;
  
  // UI state management (mixed concern)
  setActivePane: (pane: 'primary' | 'secondary') => void;
  setResizing: (resizing: boolean) => void;
  
  // Network operations (leaky abstraction)
  setCurrentTask: (taskId: string, projectId: string) => Promise<void>;
  
  // Plus: clearLayout, 5 selector hooks, and a global saveLayout function
}
```

## Problems Identified
1. **Too many methods**: 17 public methods for basic view management
2. **Mixed abstraction levels**: High-level layout operations mixed with low-level setters
3. **Granular terminal assignment**: Four separate methods for what should be one operation
4. **Network concerns leaked**: API calls embedded in state management
5. **UI state pollution**: Resizing state doesn't belong in layout management
6. **Global side effects**: `saveLayout()` function operates on global state
7. **Violates single responsibility**: Layout + terminals + UI + networking

## Proposed Solution
Create a deep module with a simple, high-level interface:

```typescript
interface SplitViewStore {
  // High-level layout management (5 methods max)
  setLayout(taskId: string, layout: ViewLayout): void;
  cycleLayout(taskId: string): void;
  assignTerminals(taskId: string, terminals: TerminalAssignment): void;
  
  // Simple state queries
  getLayout(taskId: string): ViewLayout;
  getCurrentTaskId(): string | null;
  
  // Cleanup
  clearTask(taskId: string): void;
  reset(): void;
}

// Separate concerns into focused modules:
interface ViewLayout {
  mode: 'tab' | 'split' | 'quad';
  orientation?: 'horizontal' | 'vertical';
  splitRatio?: number;
}

interface TerminalAssignment {
  primary?: string;
  secondary?: string;
  tertiary?: string;
  quaternary?: string;
}

// Move network operations to service layer:
class LayoutPersistenceService {
  async loadLayout(taskId: string): Promise<ViewLayout>;
  async saveLayout(taskId: string, layout: ViewLayout): Promise<void>;
}

// Move UI state to UI components:
// Resizing state belongs in the component that handles resizing
```

## Implementation Steps
1. **Extract network operations** to dedicated service
2. **Consolidate terminal assignment** into single high-level method
3. **Remove UI state pollution** (resizing, activePane)
4. **Hide implementation details** of layout storage
5. **Create facade for layout operations** instead of exposing individual setters
6. **Reduce public interface** from 17 methods to ~7
7. **Add proper encapsulation tests**

## Benefits
- **Information hiding**: Layout implementation details invisible
- **Single responsibility**: Only manages view layout state
- **Reduced cognitive load**: Simple interface for common operations
- **Better separation**: Network, UI, and state concerns separated
- **Easier testing**: Can test layout logic without mocking network/UI
- **Composable**: High-level operations work well together

## Examples of Improved Usage
```typescript
// Before (shallow module):
const { 
  setPrimaryTerminal, 
  setSecondaryTerminal, 
  setTertiaryTerminal,
  setQuaternaryTerminal,
  cycleSplitMode,
  setCurrentTask,
  updateLayout 
} = useSplitViewStore();

// Complex manual coordination required:
setPrimaryTerminal(terminalA);
setSecondaryTerminal(terminalB);
setTertiaryTerminal(terminalC);
setQuaternaryTerminal(terminalD);
cycleSplitMode();
await setCurrentTask(taskId, projectId);
updateLayout({ splitRatio: 0.6 });

// After (deep module):
const splitView = useSplitViewStore();

// Simple, high-level operations:
splitView.setLayout(taskId, { mode: 'quad', splitRatio: 0.6 });
splitView.assignTerminals(taskId, {
  primary: terminalA,
  secondary: terminalB,
  tertiary: terminalC,
  quaternary: terminalD
});
```

## Priority: High
This store is central to the split view feature and its complexity affects every component that manages terminal layouts. The exposed implementation details make it error-prone.

## Estimated Effort: 3 days
- Day 1: Extract network operations and create service layer
- Day 2: Consolidate terminal assignment and reduce interface
- Day 3: Update all consumers and add proper tests

## Related
- Similar to terminalStore complexity (BUG-020)
- Part of frontend state management shallow module pattern
- Affects all split view components
- Related to mixed abstraction levels throughout frontend

## Filed: 2025-08-03