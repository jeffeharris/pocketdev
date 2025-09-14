# Type System Migration Guide

## Overview
We've unified the type system across frontend and backend to improve AI assistance and reduce confusion. All shared types are now in `/shared/types/`.

## Key Changes

### 1. Session ID Normalization
**Before:** 3 different ID systems
```typescript
// Frontend confusion
sessionId: string;           // Sometimes Shelltender, sometimes DB
dbSessionId: string;         // Database ID
shelltenderSessionId: string; // Shelltender ID
normalizedId?: string;       // Another ID
```

**After:** Single ID system
```typescript
interface TerminalSession {
  id: string;              // Primary identifier (database ID)
  shelltenderId: string;   // Shelltender ID (internal detail only)
  // ... other fields
}
```

### 2. Consistent Property Names
**Before:** Mixed snake_case and camelCase
```typescript
// Frontend
created_at: string;
project_id: string;

// Backend  
createdAt: string;
projectId: string;
```

**After:** camelCase everywhere
```typescript
createdAt: string;
projectId: string;
```

### 3. Unified Enums
**Before:** String literals everywhere
```typescript
// Frontend
state: 'active' | 'merged' | 'archived';

// Backend
status: 'active';  // Different property name!
```

**After:** Shared enum constants
```typescript
import { TaskState } from '@shared/types';

state: TaskState;  // TaskState.Active, TaskState.Merged, etc.
```

## Migration Steps

### Frontend (TypeScript)

1. **Update imports:**
```typescript
// Before
import { Task, WorkerStatus } from '../types/task';

// After
import { Task, WorkerStatus } from '@shared/types';
```

2. **Update property access:**
```typescript
// Before
if (task.created_at) { }
if (session.dbSessionId) { }

// After
if (task.createdAt) { }
if (session.id) { }  // Use primary ID
```

3. **Use type guards:**
```typescript
import { isTaskState, isWorkerStatus } from '@shared/types';

if (isTaskState(value)) {
  // value is now typed as TaskState
}
```

### Backend (JavaScript)

1. **Add JSDoc type imports:**
```javascript
/**
 * @typedef {import('@shared/types').Task} Task
 * @typedef {import('@shared/types').CreateTaskDTO} CreateTaskDTO
 */
```

2. **Import constants:**
```javascript
import { TaskState, WorkerStatus } from '@shared/types';

// Use constants
if (task.state === TaskState.Active) { }
```

3. **Update property names in database queries:**
```javascript
// Before
const task = {
  project_id: projectId,
  created_at: new Date()
};

// After - map at the boundary
const task = {
  projectId,
  createdAt: new Date().toISOString()
};

// When saving to DB, map back if needed
const dbRow = {
  project_id: task.projectId,
  created_at: task.createdAt
};
```

## Property Mapping Reference

| Old Property | New Property | Notes |
|-------------|--------------|-------|
| `created_at` | `createdAt` | |
| `updated_at` | `updatedAt` | |
| `project_id` | `projectId` | |
| `task_id` | `taskId` | |
| `worktree_path` | `worktreePath` | |
| `base_branch` | `baseBranch` | |
| `repo_url` | `repoUrl` | |
| `local_path` | `localPath` | |
| `dbSessionId` | `id` | Use primary ID |
| `sessionId` | `id` or `shelltenderId` | Context-dependent |
| `has_uncommitted_changes` | `hasUncommittedChanges` | |
| `has_conflicts` | `hasConflicts` | |

## API Response Standardization

All API responses should now use the standard wrapper:

```typescript
// Success response
{
  success: true,
  data: { /* actual data */ },
  correlationId: "abc-123"
}

// Error response
{
  success: false,
  error: "Error message",
  correlationId: "abc-123"
}
```

## Benefits

1. **AI Assistance**: AI can now predict types consistently
2. **Type Safety**: Single source of truth for types
3. **Reduced Bugs**: No more property name mismatches
4. **Cleaner Code**: No more type duplication
5. **Better IntelliSense**: Full autocomplete in both TS and JS

## Gradual Migration

You don't need to migrate everything at once:

1. Start with new code using shared types
2. Update existing code when you touch it
3. Use backward compatibility exports during transition
4. Remove deprecated types once migration is complete

## Quick Reference

```typescript
// Import everything you need
import {
  // Types
  Task,
  Project,
  TerminalSession,
  GitStatus,
  
  // Enums
  TaskState,
  WorkerStatus,
  AIAgent,
  
  // Type guards
  isTaskState,
  isWorkerStatus,
  
  // DTOs
  CreateTaskDTO,
  UpdateTaskDTO
} from '@shared/types';
```

## Common Gotchas

1. **Database column names**: Database still uses snake_case. Map at the boundary.
2. **API contracts**: Update both frontend and backend together to avoid mismatches.
3. **Session IDs**: Always use `session.id` as primary identifier, `shelltenderId` is internal.
4. **Import paths**: Use `@shared/types` or relative path `../../shared/types/index`.