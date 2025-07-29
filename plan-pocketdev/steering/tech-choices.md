# PocketDev Technology Choices

This document explains key technology decisions and patterns for the PocketDev codebase.

## State Management: Zustand

### Decision: Adopt Zustand for Client-Side State Management

**Date**: 2025-07-29  
**Status**: Approved  
**Context**: Split views feature requires sophisticated state management beyond prop drilling

### Why Zustand?

1. **Lightweight** (~8KB) - Minimal bundle size impact
2. **TypeScript First** - Excellent type inference, no boilerplate
3. **React-Friendly** - Uses React hooks naturally
4. **No Providers** - Cleaner component tree
5. **DevTools Support** - Redux DevTools compatible
6. **Simple Learning Curve** - Team can adopt quickly

### Comparison

| Feature | Zustand | Redux Toolkit | Context API | MobX |
|---------|---------|---------------|-------------|------|
| Bundle Size | 8KB | 40KB+ | 0KB | 50KB+ |
| Boilerplate | Minimal | Moderate | Minimal | Moderate |
| TypeScript | Excellent | Good | Basic | Good |
| Learning Curve | Easy | Moderate | Easy | Steep |
| Performance | Excellent | Good | Poor* | Excellent |

*Context API causes unnecessary re-renders without careful optimization

### Implementation Pattern

```typescript
// stores/terminalStore.ts
interface TerminalStore {
  // State
  sessions: Map<string, TerminalSession>;
  activeTerminals: Map<string, string[]>; // taskId -> sessionIds
  
  // Computed
  getTaskSessions: (taskId: string) => TerminalSession[];
  getActiveSession: (taskId: string) => TerminalSession | null;
  
  // Actions
  updateSession: (sessionId: string, updates: Partial<TerminalSession>) => void;
  setActiveTerminal: (taskId: string, sessionId: string) => void;
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  sessions: new Map(),
  activeTerminals: new Map(),
  
  getTaskSessions: (taskId) => {
    return Array.from(get().sessions.values())
      .filter(session => session.taskId === taskId);
  },
  
  updateSession: (sessionId, updates) => {
    set(state => {
      const session = state.sessions.get(sessionId);
      if (session) {
        state.sessions.set(sessionId, { ...session, ...updates });
      }
      return { sessions: new Map(state.sessions) };
    });
  }
}));
```

## Planned Zustand Use Cases

### 1. Split View Layouts (Immediate)
```typescript
interface SplitViewStore {
  layouts: Map<string, LayoutConfig>;
  updateLayout: (taskId: string, config: LayoutConfig) => void;
  toggleSplitMode: (taskId: string) => void;
}
```

### 2. Terminal Session State (High Priority)
Replace prop drilling in TaskWorkspace → Sidebar → TaskListItem → TaskStatus
```typescript
interface TerminalSessionStore {
  sessionStates: Map<string, TerminalSessionState[]>;
  aggregatedStates: Map<string, AggregatedState>; // Cached
  
  updateSessionState: (taskId: string, sessions: TerminalSessionState[]) => void;
  getAggregatedState: (taskId: string) => AggregatedState;
  getHighestPrioritySession: (taskId: string) => string | undefined;
}
```

### 3. Task Management (Medium Priority)
Centralize task state currently spread across components
```typescript
interface TaskStore {
  tasks: Map<string, Task>;
  selectedTaskId: string | null;
  
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  selectTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
}
```

### 4. WebSocket Event Handling (Future)
Coordinate WebSocket events with stores
```typescript
// WebSocket middleware pattern
const websocketMiddleware = (ws: WebSocket) => {
  ws.on('terminal-state-changed', (data) => {
    useTerminalStore.getState().updateSession(data.sessionId, data);
  });
  
  ws.on('task-updated', (data) => {
    useTaskStore.getState().updateTask(data.taskId, data);
  });
};
```

### 5. UI Preferences (Future)
User preferences and UI state
```typescript
interface UIStore {
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  terminalFontSize: number;
  
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
}
```

## Migration Strategy

### Phase 1: New Features (Immediate)
- Use Zustand for all new features (starting with split views)
- No refactoring of existing code yet

### Phase 2: High-Value Refactors (Q1 2025)
- Terminal session state management
- Task status aggregation
- Eliminate complex prop drilling

### Phase 3: Comprehensive Migration (Q2 2025)
- Migrate remaining Context API usage
- Unify all client state in Zustand
- Add middleware for persistence

## Best Practices

### 1. Store Organization
```
frontend/src/stores/
├── terminalStore.ts      // Terminal-related state
├── taskStore.ts          // Task management
├── splitViewStore.ts     // Layout state
├── uiStore.ts            // UI preferences
└── index.ts              // Re-exports
```

### 2. Naming Conventions
- Store files: `{domain}Store.ts`
- Hook names: `use{Domain}Store`
- Action names: Verbs (`updateTask`, not `taskUpdated`)
- Computed names: Getters (`getActiveTask`, not `activeTask`)

### 3. Performance Patterns
```typescript
// ❌ Bad: Causes unnecessary re-renders
const allSessions = useTerminalStore(state => state.sessions);

// ✅ Good: Subscribe to specific data
const taskSessions = useTerminalStore(
  state => state.getTaskSessions(taskId)
);

// ✅ Better: Shallow equality check
const taskSessions = useTerminalStore(
  state => state.getTaskSessions(taskId),
  shallow
);
```

### 4. Testing
```typescript
// Easy to test stores in isolation
describe('TerminalStore', () => {
  beforeEach(() => {
    useTerminalStore.setState({ sessions: new Map() });
  });
  
  it('updates session state', () => {
    const { updateSession } = useTerminalStore.getState();
    updateSession('123', { aiState: 'working' });
    
    const session = useTerminalStore.getState().sessions.get('123');
    expect(session?.aiState).toBe('working');
  });
});
```

## Anti-Patterns to Avoid

### 1. ❌ Storing Derived State
```typescript
// Bad: Storing computed values
interface BadStore {
  tasks: Task[];
  activeTasks: Task[]; // Derived from tasks
  completedTasks: Task[]; // Derived from tasks
}

// Good: Compute on demand
interface GoodStore {
  tasks: Task[];
  getActiveTasks: () => Task[];
  getCompletedTasks: () => Task[];
}
```

### 2. ❌ Storing Non-Serializable Data
```typescript
// Bad: Storing class instances, functions
interface BadStore {
  xtermInstance: Terminal; // Will break DevTools
  wsConnection: WebSocket; // Will break persistence
}

// Good: Store IDs, recreate instances
interface GoodStore {
  terminalId: string;
  wsUrl: string;
}
```

### 3. ❌ Deeply Nested Updates
```typescript
// Bad: Mutating nested state
set(state => {
  state.tasks[0].subtasks[0].status = 'done'; // Mutation!
});

// Good: Immutable updates
set(state => ({
  tasks: state.tasks.map((task, i) => 
    i === 0 ? {
      ...task,
      subtasks: task.subtasks.map((subtask, j) =>
        j === 0 ? { ...subtask, status: 'done' } : subtask
      )
    } : task
  )
}));
```

## Decision Record

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-07-29 | Adopt Zustand | Split views need better state management than prop drilling |
| 2025-07-29 | Stores per domain | Easier to maintain than monolithic store |
| 2025-07-29 | No Redux | Too much boilerplate for our needs |
| 2025-07-29 | No MobX | Team unfamiliar, steeper learning curve |

## Future Considerations

1. **Persistence**: Add localStorage persistence for UI preferences
2. **Time-Travel**: Enable Redux DevTools for debugging
3. **Middleware**: Add logging, analytics, error tracking
4. **Server State**: Consider Tanstack Query for server data
5. **Real-time Sync**: WebSocket middleware for live updates

## References

- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Zustand Best Practices](https://docs.pmnd.rs/zustand/guides/best-practices)
- [When to Use Zustand](https://docs.pmnd.rs/zustand/getting-started/comparison)