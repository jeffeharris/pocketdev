# BUG-018: Deduplicate Terminal State Aggregation Logic

<!-- Document Metadata
Created: 2025-08-01
Modified: 2025-08-01
Status: ????
-->


## Summary
Terminal state aggregation logic is duplicated between TaskListItem and TaskStatus components, violating the DRY principle and Ousterhout's concept of pulling complexity downward. While TaskStatus has been improved, TaskListItem still maintains its own aggregation logic.

## Current State
- **Files**: 
  - `/frontend/src/components/task/TaskListItem.tsx` (lines 33-59)
  - `/frontend/src/components/task/TaskStatus.tsx` (lines 84-111)
- **Problem**: Both components calculate aggregated state from session states
- **Partial Fix**: TaskStatus now handles most display logic, but TaskListItem still aggregates

## Evidence
```typescript
// TaskListItem.tsx - Duplicate aggregation logic
const calculateAggregatedState = () => {
  // Priority order: waiting > working > idle > not-started
  const statePriority: Record<string, number> = {
    'waiting': 4,
    'working': 3,
    'idle': 2,
    'not-started': 1
  };
  
  let highestPriority = 0;
  let aggregatedStatus = WorkerStatus.NotStarted;
  
  for (const session of currentSessionStates) {
    const priority = statePriority[session.aiState] || 0;
    if (priority > highestPriority) {
      highestPriority = priority;
      aggregatedStatus = session.aiState as WorkerStatus;
    }
  }
  
  return { status: aggregatedStatus, lastStateChange: null };
};

// TaskStatus.tsx - Similar logic for finding priority session
const getHighestPrioritySessionId = (): string | undefined => {
  // Same priority order calculation
  const statePriority: Record<string, number> = {
    'waiting': 4,
    'working': 3,
    'idle': 2,
    'not-started': 1
  };
  // ... similar sorting logic
};
```

## Problems Identified
1. **Code duplication**: Same priority logic in multiple places
2. **Maintenance risk**: Changes to priority must be made in multiple locations
3. **Mixed responsibilities**: Components calculate AND display state
4. **Testing complexity**: Business logic mixed with UI components

## Additional Complexity
- State passed through props: `TaskWorkspace` → `Sidebar` → `TaskListItem` → `TaskStatus`
- Multiple state formats being converted between components
- SessionStorage used for passing focus tab IDs between components

## Proposed Solution
Create a centralized state management solution:

```typescript
// Create a custom hook or service for state aggregation
export const useTerminalStateAggregation = () => {
  const STATE_PRIORITY = {
    'waiting': 4,
    'working': 3,
    'idle': 2,
    'not-started': 1
  } as const;
  
  const getAggregatedState = (sessions: IndividualSessionState[]) => {
    if (!sessions || sessions.length === 0) {
      return { status: WorkerStatus.NotStarted, lastStateChange: null };
    }
    
    // Single source of truth for aggregation logic
    const highestPriority = sessions.reduce((best, session) => {
      const priority = STATE_PRIORITY[session.aiState] || 0;
      const bestPriority = STATE_PRIORITY[best.aiState] || 0;
      return priority > bestPriority ? session : best;
    });
    
    return {
      status: highestPriority.aiState,
      lastStateChange: highestPriority.lastStateChange
    };
  };
  
  const getHighestPrioritySessionId = (sessions: IndividualSessionState[]) => {
    // Reuse the same logic
    const aggregated = getAggregatedState(sessions);
    return sessions.find(s => s.aiState === aggregated.status)?.id;
  };
  
  return { getAggregatedState, getHighestPrioritySessionId, STATE_PRIORITY };
};
```

## Implementation Steps
1. Create `useTerminalStateAggregation` hook with all aggregation logic
2. Update TaskListItem to use the hook instead of local calculation
3. Update TaskStatus to use the same hook for consistency
4. Consider moving to a global store (Zustand) for terminal states
5. Remove prop drilling by accessing state directly from store

## Benefits
- **Single source of truth**: Priority logic in one place
- **Testability**: Business logic separated from components
- **Maintainability**: Changes to aggregation logic in one location
- **Performance**: Can memoize aggregated states
- **Simplicity**: Components focus on display, not calculation

## Priority: High
While not as critical as other architectural issues, this duplication affects core UI components and creates maintenance burden. The state management complexity is growing and needs to be addressed.

## Estimated Effort: 1-2 days
- 0.5 day to create the hook/service
- 0.5 day to update components
- 0.5 day for testing
- 0.5 day buffer for store migration if needed

## Related
- Mentioned in `/plan-pocketdev/steering/tech-debt.md` (lines 161-248)
- Affects TaskListItem, TaskStatus, and potentially other components
- Part of larger state management improvements needed

## Filed: 2025-08-01