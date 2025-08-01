# BUG-016: Remove Mock Code from Production

## Summary
The frontend api.ts file contains mock code mixed with production code using `if (USE_MOCKS)` checks throughout, violating Ousterhout's principle of pulling complexity downward and information hiding.

## Current State
- **File**: `/frontend/src/services/api.ts`
- **Pattern**: Every method contains mock logic alongside production code
- **Problem**: Doubles complexity, increases bug surface area

## Problems Identified
1. **Mixed concerns**: Test code polluting production logic
2. **Cognitive load**: Must understand both paths to modify methods
3. **Maintenance burden**: Mock data must be updated alongside API changes
4. **Error prone**: Easy to accidentally use wrong code path

## Code Example
```typescript
// Current anti-pattern in every method:
async getProject(id: string): Promise<Project> {
  if (USE_MOCKS) {
    // Mock implementation
    const mockProject = MOCK_PROJECTS.find(p => p.id === id);
    if (!mockProject) throw new Error('Project not found');
    return mockProject;
  }
  
  // Production implementation
  const data = await this.fetch(`/api/projects/${id}`);
  return this.mapProject(data);
}
```

## Proposed Solution
Use dependency injection or factory pattern:

```typescript
// api-factory.ts
export function createApiService(): ApiService {
  return import.meta.env.VITE_USE_MOCKS === 'true' 
    ? new MockApiService() 
    : new HttpApiService();
}

// HttpApiService.ts - Production only
export class HttpApiService implements ApiService {
  async getProject(id: string): Promise<Project> {
    const data = await this.fetch(`/api/projects/${id}`);
    return this.mapProject(data);
  }
}

// MockApiService.ts - Mock only
export class MockApiService implements ApiService {
  async getProject(id: string): Promise<Project> {
    const mockProject = MOCK_PROJECTS.find(p => p.id === id);
    if (!mockProject) throw new Error('Project not found');
    return mockProject;
  }
}
```

## Implementation Steps
1. Define `ApiService` interface
2. Create `HttpApiService` with production code only
3. Create `MockApiService` with mock implementations
4. Implement `createApiService` factory
5. Update all imports to use factory
6. Remove `USE_MOCKS` constant and checks

## Benefits
- **Separation of concerns**: Production and test code clearly separated
- **Cleaner code**: Each implementation focused on its purpose
- **Type safety**: Interface ensures both implementations match
- **Easier testing**: Can easily swap implementations

## Priority: Medium
While not blocking functionality, this significantly impacts code quality and maintainability.

## Estimated Effort: 1 day

## Filed: 2025-08-01