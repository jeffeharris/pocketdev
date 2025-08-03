# Terminal Store Migration Guide

This guide explains how to migrate from the shallow terminalStore (34+ methods) to the deep terminalStore (8 methods).

## Why Migrate?

The current terminalStore violates deep module principles:
- **34+ public methods** expose implementation details
- **Leaky abstractions** with exposed Maps and granular operations
- **Complex usage** requiring multiple method calls for single operations
- **Tight coupling** to internal data structures

The new deep module provides:
- **8 simple methods** hiding all complexity
- **Atomic operations** that complete in one call
- **Business-focused** interface matching domain concepts
- **Easier testing** with fewer methods to mock

## Migration Strategy

### Phase 1: Use Adapter (Current)
Import from the adapter to maintain compatibility:

```typescript
// Old imports - DON'T CHANGE YET
import { useTerminalStore, useTaskTerminals } from '../../stores/terminalStore';

// New imports - USE ADAPTER
import { useTerminalStore, useTaskTerminals } from '../../stores/terminal/terminalStore.adapter';
```

### Phase 2: Refactor to Deep Module
Gradually update components to use the new interface:

```typescript
// Import from deep module directly
import { useTerminalStore, useTaskTerminals } from '../../stores/terminal/terminalStore.deep';
```

## Usage Examples

### Before (Shallow Module) - 6 Method Calls
```typescript
const store = useTerminalStore();

// Creating a terminal requires multiple calls
store.addTerminal(taskId, terminal);
store.setActiveTerminal(taskId, terminal.dbSessionId);
store.setFocusedTerminal(taskId, terminal.dbSessionId);
store.registerDisposal(terminal.dbSessionId, cleanup);
store.setLoading(taskId, false);
const activeTerminal = store.getActiveTerminal(taskId);
```

### After (Deep Module) - 2 Method Calls
```typescript
const store = useTerminalStore();

// Single atomic operation
store.updateTerminal(taskId, terminalId, { 
  type: 'create', 
  config: { 
    ...terminalConfig, 
    autoFocus: true,
    disposalCallback: cleanup
  } 
});
const state = store.getTaskState(taskId);
```

## Common Patterns

### 1. Initialize Task with Terminals
```typescript
// Before
store.setTerminals(taskId, terminals);
store.setLoading(taskId, false);

// After
store.initializeTask(taskId, terminals); // Loading handled internally
```

### 2. Create New Terminal
```typescript
// Before
store.addTerminal(taskId, terminal);
store.setActiveTerminal(taskId, terminal.dbSessionId);
store.registerDisposal(terminal.dbSessionId, cleanup);

// After
store.updateTerminal(taskId, terminal.dbSessionId, {
  type: 'create',
  config: {
    ...terminal,
    autoFocus: true,
    disposalCallback: cleanup
  }
});
```

### 3. Update Terminal State
```typescript
// Before
store.updateTerminalState(taskId, dbSessionId, 'working');

// After
store.updateTerminal(taskId, dbSessionId, {
  type: 'state-change',
  aiState: 'working'
});
```

### 4. Remove Terminal
```typescript
// Before
store.disposeTerminal(dbSessionId);
store.removeTerminal(taskId, dbSessionId);

// After
store.updateTerminal(taskId, dbSessionId, { type: 'remove' });
// Disposal handled automatically
```

### 5. Get Task State
```typescript
// Before (multiple calls)
const terminals = store.getTerminals(taskId);
const activeTerminal = store.getActiveTerminal(taskId);
const focusedTerminal = store.getFocusedTerminal(taskId);
const loading = store.isLoading(taskId);

// After (single call)
const { terminals, activeTerminal, focusedTerminal, loading } = store.getTaskState(taskId);
```

### 6. Bulk Operations
```typescript
// Before
terminals.forEach(({ dbSessionId, tabOrder }) => {
  store.updateTerminal(taskId, dbSessionId, { tabOrder });
});

// After
terminals.forEach(({ dbSessionId, tabOrder }) => {
  store.updateTerminal(taskId, dbSessionId, { type: 'reorder', order: tabOrder });
});
```

## Component Migration Example

### Before (TerminalPanel using shallow store)
```typescript
const store = useTerminalStore();
const terminals = useTaskTerminals(task.id);
const activeTerminalId = useActiveTerminalId(task.id);

// Complex initialization
useEffect(() => {
  if (task.terminals) {
    store.setTerminals(task.id, task.terminals);
    store.setLoading(task.id, false);
  }
}, [task]);

// Multiple calls to create terminal
const handleCreateTerminal = (config: TerminalConfig) => {
  store.addTerminal(task.id, config);
  store.setActiveTerminal(task.id, config.dbSessionId);
  store.registerDisposal(config.dbSessionId, () => cleanup());
};
```

### After (TerminalPanel using deep store)
```typescript
const store = useTerminalStore();
const { terminals, activeTerminal, loading } = useTaskTerminalState(task.id);

// Simple initialization
useEffect(() => {
  if (task.terminals) {
    store.initializeTask(task.id, task.terminals);
  }
}, [task]);

// Single call to create terminal
const handleCreateTerminal = (config: TerminalConfig) => {
  store.updateTerminal(task.id, config.dbSessionId, {
    type: 'create',
    config: { ...config, autoFocus: true, disposalCallback: cleanup }
  });
};
```

## Testing Benefits

### Before (Mock 34+ methods)
```typescript
const mockStore = {
  setTerminals: jest.fn(),
  addTerminal: jest.fn(),
  updateTerminal: jest.fn(),
  removeTerminal: jest.fn(),
  setActiveTerminal: jest.fn(),
  setFocusedTerminal: jest.fn(),
  // ... 28 more methods to mock
};
```

### After (Mock 8 methods)
```typescript
const mockStore = {
  initializeTask: jest.fn(),
  disposeTask: jest.fn(),
  updateTerminal: jest.fn(),
  getTaskState: jest.fn(),
  getActiveTerminal: jest.fn(),
  setActiveTerminal: jest.fn(),
  reset: jest.fn(),
  isLoading: jest.fn()
};
```

## Migration Checklist

- [ ] Replace imports with adapter imports
- [ ] Test that functionality still works
- [ ] Identify complex multi-method operations
- [ ] Refactor to use single atomic operations
- [ ] Replace getters with `getTaskState()`
- [ ] Remove disposal registration (use config instead)
- [ ] Update tests to use deep module interface
- [ ] Switch imports to deep module directly
- [ ] Remove adapter imports once migrated

## Timeline

1. **Week 1**: All new code uses deep module
2. **Week 2**: Migrate high-traffic components (TerminalPanel, TaskWorkspace)
3. **Week 3**: Migrate remaining components
4. **Week 4**: Remove adapter and old store

## Questions?

If you encounter issues during migration:
1. Check if the adapter supports your use case
2. Consider if you're using the store correctly
3. The deep module may reveal design issues in your component