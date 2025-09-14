# BUG-011: api.ts needs domain splitting

<!-- Document Metadata
Created: 2025-08-03
Modified: 2025-08-03
Status: ????
-->


## Issue
The `api.ts` file is 848 lines with a single `ApiService` class containing 44 methods across 7 different domains. This creates an extremely shallow module with the worst interface-to-implementation ratio in the codebase - the interface (44 public methods) is nearly as complex as the implementation itself, violating Ousterhout's deep module principle.

## Current Problems
1. **God object pattern**: Single class handles projects, tasks, git, containers, settings, terminals, and images
2. **Inline mocking**: Every method has `if (USE_MOCKS)` with hardcoded test data
3. **Repeated mapping logic**: Same response mapping copied multiple times
4. **Type safety issues**: Extensive use of `any` types, manual mapping without validation
5. **Mixed abstractions**: Low-level fetch wrapper mixed with high-level business operations
6. **Inconsistent patterns**: Some methods use the internal fetch wrapper, others use native fetch

## Impact
- Difficult to test individual API domains
- Mock data mixed with production logic
- High risk of breaking unrelated features when modifying
- Poor type safety leads to runtime errors
- Hard to onboard new developers

## Proposed Solution
Split into domain-specific services with shared infrastructure:

```
frontend/src/services/
├── api/
│   ├── base.ts                    # ~60 lines - Shared fetch wrapper
│   ├── projects.api.ts            # ~150 lines - Project operations
│   ├── tasks.api.ts               # ~120 lines - Task CRUD
│   ├── git.api.ts                 # ~180 lines - Git operations
│   ├── terminals.api.ts           # ~100 lines - Terminal management
│   ├── containers.api.ts          # ~60 lines - Container operations
│   ├── settings.api.ts            # ~80 lines - Settings management
│   ├── images.api.ts              # ~60 lines - Image uploads
│   └── index.ts                   # ~20 lines - Exports
├── mocks/
│   ├── mock-provider.ts           # ~40 lines - Mock system
│   ├── projects.mocks.ts          # Mock data for projects
│   ├── tasks.mocks.ts             # Mock data for tasks
│   └── [etc...]
└── mappers/
    ├── project.mapper.ts          # ~30 lines - Type mapping
    ├── task.mapper.ts             # ~40 lines - Type mapping
    └── [etc...]
```

## Specific Refactorings

### 1. Extract Base Service
```typescript
// api/base.ts
export abstract class BaseApiService {
  private baseUrl = '/api';
  
  protected async fetch<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw await this.parseError(response);
    }

    return response.json();
  }
  
  protected get<T>(url: string) { 
    return this.fetch<T>(url); 
  }
  
  protected post<T>(url: string, body?: any) {
    return this.fetch<T>(url, { method: 'POST', body: JSON.stringify(body) });
  }
  
  protected patch<T>(url: string, body?: any) {
    return this.fetch<T>(url, { method: 'PATCH', body: JSON.stringify(body) });
  }
  
  protected delete(url: string) {
    return this.fetch<void>(url, { method: 'DELETE' });
  }
}
```

### 2. Domain-Specific Services
```typescript
// api/projects.api.ts
export class ProjectsApi extends BaseApiService {
  async getProjects(): Promise<Project[]> {
    const response = await this.get<ApiProjectResponse[]>('/projects');
    return response.map(mapProjectResponse);
  }
  
  async getProject(id: string): Promise<Project> {
    const response = await this.get<ApiProjectResponse>(`/projects/${id}`);
    return mapProjectResponse(response);
  }
  
  // ... other project methods
}
```

### 3. Centralized Mock System
```typescript
// mocks/mock-provider.ts
export class MockProvider {
  private static enabled = import.meta.env.VITE_USE_MOCKS === 'true';
  
  static async resolve<T>(mockData: T | (() => T), realCall: () => Promise<T>): Promise<T> {
    if (this.enabled) {
      return typeof mockData === 'function' ? mockData() : mockData;
    }
    return realCall();
  }
}

// Usage in service:
async getProjects(): Promise<Project[]> {
  return MockProvider.resolve(
    projectMocks.list,
    async () => {
      const response = await this.get<ApiProjectResponse[]>('/projects');
      return response.map(mapProjectResponse);
    }
  );
}
```

### 4. Type-Safe Mappers
```typescript
// mappers/project.mapper.ts
import { z } from 'zod'; // or similar validation library

const ApiProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  repo_url: z.string().optional(),
  repository: z.string().optional(),
  base_branch: z.string().optional(),
  baseBranch: z.string().optional(),
  created_at: z.string().optional(),
  created: z.string().optional(),
  task_count: z.number().optional(),
  tasksCount: z.number().optional()
});

export const mapProjectResponse = (data: unknown): Project => {
  const validated = ApiProjectSchema.parse(data);
  
  return {
    id: validated.id,
    name: validated.name,
    repository: validated.repo_url || validated.repository || '',
    baseBranch: validated.base_branch || validated.baseBranch || 'main',
    created: validated.created_at || validated.created || new Date().toISOString(),
    tasksCount: validated.task_count || validated.tasksCount || 0
  };
};
```

### 5. Composed API Export
```typescript
// api/index.ts
export const api = {
  projects: new ProjectsApi(),
  tasks: new TasksApi(),
  git: new GitApi(),
  terminals: new TerminalsApi(),
  containers: new ContainersApi(),
  settings: new SettingsApi(),
  images: new ImagesApi()
};

// Maintains backward compatibility:
// api.getProjects() becomes api.projects.getProjects()
```

## Success Criteria
- [ ] No API service file over 200 lines
- [ ] Mock logic completely separated from service code
- [ ] Type-safe response mapping with validation
- [ ] Each domain independently testable
- [ ] Consistent patterns across all services
- [ ] No `any` types in public APIs

## Priority
**Critical** - This has the worst interface complexity in the entire codebase (44 public methods). Every frontend operation goes through this shallow module, making it a bottleneck for development and testing.

## Estimated Impact
- **Code reduction**: ~2% (mock extraction)
- **Type safety**: 100% validated responses
- **Test coverage**: Each domain can be tested in isolation
- **Developer experience**: Clear where to add new endpoints
- **Performance**: Lazy-load only needed API services

## Migration Strategy
1. Create base service and mock provider (no breaking changes)
2. Extract one domain at a time, starting with smallest (containers)
3. Update imports progressively
4. Remove old ApiService once all domains migrated

## Related
- Part of the "Marie Kondo" cleanup initiative
- Similar to backend controller splitting (BUG-004, BUG-010)
- Improves type safety across the application