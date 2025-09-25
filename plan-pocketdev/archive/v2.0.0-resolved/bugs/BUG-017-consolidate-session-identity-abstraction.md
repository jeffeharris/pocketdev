# BUG-017: Consolidate Session Identity Abstraction

<!-- Document Metadata
Created: 2025-08-03
Modified: 2025-08-03
Status: ????
-->


## Summary
The frontend has three different session ID fields (sessionId, dbSessionId, shelltenderSessionId) that expose implementation details and create confusion throughout the codebase. This violates Ousterhout's information hiding principle.

## Current State
- **File**: `/frontend/src/types/task.ts` (lines 57-59)
- **Problem**: Multiple ID fields for the same conceptual entity
- **Impact**: Every component must understand the difference between these IDs

## Evidence
```typescript
// From task.ts
interface TerminalSession {
  sessionId: string;           // Shelltender session ID (for backward compatibility)
  dbSessionId: string;         // Database session ID (stable identifier)
  shelltenderSessionId: string; // Shelltender session ID (explicit)
  // ... rest of interface
}
```

## Problems Identified
1. **Leaky abstraction**: Implementation details (database vs Shelltender) exposed in interface
2. **Confusion**: Developers must know which ID to use when
3. **Maintenance burden**: Changes to session management affect many files
4. **Backward compatibility cruft**: "for backward compatibility" comment suggests technical debt

## Code Impact
- 21 files in frontend reference these session IDs
- Components like TerminalPanel, SplitViewContainer, DirectTerminal all handle ID mapping
- Test files also affected by this complexity

## Proposed Solution
Create a proper abstraction that hides implementation details:

```typescript
// Single source of truth for session identity
interface TerminalSession {
  id: string;              // The only ID components should use
  tabName: string;
  tabOrder: number;
  aiState: WorkerStatus;
  aiAgent: string;
  // Remove redundant ID fields
}

// Internal mapping hidden in service/store layer
class SessionIdentityService {
  private dbToShelltenderMap = new Map<string, string>();
  
  // Public API uses only the abstract ID
  getSession(id: string): TerminalSession { }
  
  // Internal methods handle mapping
  private mapToShelltenderId(id: string): string { }
  private mapFromDatabaseId(dbId: string): string { }
}
```

## Implementation Steps
1. Create `SessionIdentityService` to centralize ID mapping
2. Update `TerminalSession` interface to have single `id` field
3. Move all ID mapping logic to the service layer
4. Update components to use only the abstract `id`
5. Remove backward compatibility code once migration complete

## Benefits
- **Information hiding**: Components don't know about database vs Shelltender
- **Simplicity**: One ID to rule them all
- **Maintainability**: ID mapping changes isolated to one place
- **Type safety**: Can't accidentally use wrong ID type

## Priority: High
This abstraction leak affects 21+ files and causes confusion throughout the frontend. It's a fundamental design issue that makes the codebase harder to understand and maintain.

## Estimated Effort: 2-3 days
- 1 day to create service and update types
- 1-2 days to update all affected components
- Testing throughout

## Related
- Part of tech debt identified in `/plan-pocketdev/steering/tech-debt.md`
- Affects multi-terminal tab implementation
- Similar to backend's session management complexity

## Filed: 2025-08-01