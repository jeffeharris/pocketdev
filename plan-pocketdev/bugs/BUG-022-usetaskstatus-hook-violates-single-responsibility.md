# BUG-022: useTaskStatus Hook Violates Single Responsibility

<!-- Document Metadata
Created: 2025-08-01
Modified: 2025-08-01
Status: ????
-->


## Summary
The useTaskStatus hook combines WebSocket handling, state management, and time formatting into a single 200+ line module. This violates single responsibility and creates a shallow module with multiple concerns.

## Current State
- **File**: `/frontend/src/hooks/useTaskStatus.ts`
- **Lines**: 200+
- **Problem**: Mixing transport, business logic, and presentation

## Evidence
```typescript
export const useTaskStatus = (taskId: string) => {
  // WebSocket subscription logic
  useEffect(() => {
    subscribe(`task:${taskId}`);
    // ... handle messages
  }, []);
  
  // State transformation logic
  const handleAIStateUpdate = (data) => {
    // Complex state mapping
  };
  
  // Time formatting (50+ lines!)
  const formatTimeAgo = (timestamp: string) => {
    // Should not be in a state hook
    const diff = Date.now() - new Date(timestamp).getTime();
    if (diff < 60000) return 'just now';
    // ... many more conditions
  };
  
  return {
    taskState,
    sessionStates,
    gitStatus,
    timeAgo  // Presentation concern!
  };
};
```

## Problems Identified
1. **Multiple responsibilities**: WebSocket + state + formatting
2. **Presentation logic in business hook**: Time formatting doesn't belong
3. **Complex interface**: Returns too many different concerns
4. **Hard to test**: Must mock WebSocket and time for tests
5. **High cognitive load**: Understanding one aspect requires understanding all

## Proposed Solution
Split into focused, deep modules:

```typescript
// Pure state hook
export const useTaskState = (taskId: string) => {
  // Only task lifecycle state
  return { state: 'active' | 'merged' | 'archived' };
};

// Worker status hook
export const useWorkerStatus = (taskId: string) => {
  // Only AI worker status
  return { 
    status: 'idle' | 'working' | 'waiting',
    sessions: WorkerSession[]
  };
};

// Git status hook
export const useGitStatus = (taskId: string) => {
  // Only git information
  return { ahead: 0, behind: 0, hasConflicts: false };
};

// Presentation utility (not a hook!)
export const formatRelativeTime = (timestamp: string): string => {
  // Pure function for time formatting
};

// Compose in components as needed:
function TaskComponent({ taskId }) {
  const taskState = useTaskState(taskId);
  const workerStatus = useWorkerStatus(taskId);
  const timeAgo = formatRelativeTime(workerStatus.lastUpdate);
}
```

## Implementation Steps
1. Extract time formatting to utility functions
2. Create focused hooks for each domain
3. Move WebSocket handling to a lower layer
4. Ensure each hook has single responsibility
5. Update components to compose hooks
6. Add proper TypeScript types

## Benefits
- **Single responsibility**: Each hook does one thing well
- **Deep modules**: Simple interfaces hiding complexity
- **Testable**: Can test each concern in isolation
- **Reusable**: Can use worker status without task state
- **Clear boundaries**: Presentation logic separated

## Priority: Medium
While functional, this complexity makes the codebase harder to understand and maintain. It's a good example of the shallow module problem.

## Estimated Effort: 2 days

## Related
- Similar to TerminalPanel doing too much (BUG-015)
- Part of frontend complexity issues
- Example of missing separation of concerns

## Filed: 2025-08-01