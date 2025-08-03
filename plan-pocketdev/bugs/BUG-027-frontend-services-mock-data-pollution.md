# BUG-027: Frontend Services Mock Data Pollution

## Summary
All 8 frontend services contain extensive mock data embedded directly in production service files, violating separation of concerns and the deep module principle. Mock data often comprises 30-50% of service file content, making it difficult to understand actual business logic.

## Current State
- **Files**: All services in `/frontend/src/services/`
- **Pattern**: Mock data hardcoded in every service class
- **Scale**: ~1,000+ lines of mock data across services

## Problems Identified

### 1. Violates Separation of Concerns
Production services contain extensive test/development data mixed with business logic.

### 2. Code Bloat and Cognitive Load
- **GitService**: 389 lines total, ~150 lines (38%) are mock data
- **TaskService**: 420 lines total, ~170 lines (40%) are mock data  
- **ProjectService**: 302 lines total, ~120 lines (40%) are mock data
- **TerminalService**: 267 lines total, ~90 lines (34%) are mock data
- **ContainerService**: 230 lines total, ~95 lines (41%) are mock data
- **UploadService**: 155 lines total, ~60 lines (39%) are mock data

### 3. Maintenance Burden
Mock data must be maintained alongside API changes, doubling maintenance effort.

### 4. Bundle Size Impact
Mock data is included in production builds unnecessarily.

### 5. Makes Code Review Difficult
Reviewers must mentally filter out mock code to understand actual changes.

## Code Examples

### GitService Mock Data Pollution
```typescript
export class GitService extends BaseService {
  private mockGitStatus: GitStatus = {
    clean: false,
    ahead: 2,
    behind: 0,
    filesChanged: 3,
    branch: 'feature/test-branch',
    upToDate: false
  };

  private mockFiles: DiffFile[] = [
    {
      path: 'src/components/Button.tsx',
      type: 'modified',
      additions: 15,
      deletions: 3,
      status: ' M',
      category: 'unstaged' as FileCategory,
      staged: false,
      unstaged: true,
      untracked: false,
      committed: false
    },
    // ... 3 more mock files
  ];

  // Mock diff data includes full git diff strings (40+ lines)
  const mockDiff = `diff --git a/src/components/Button.tsx b/src/components/Button.tsx
index 1234567..abcdefg 100644
--- a/src/components/Button.tsx
+++ b/src/components/Button.tsx
@@ -1,6 +1,8 @@
 import React from 'react';
+import { cn } from '../utils/cn';
...`;
}
```

### TaskService Mock Task Army
```typescript
export class TaskService extends BaseService {
  private mockTasks: Task[] = [
    {
      id: '17db1cde001',
      name: 'Update the task view page',
      description: 'Improve the task view UI and add better status indicators',
      branch: 'feature/task-view-page',
      worktree_path: '/projects/17db1cde-task-001',
      created_at: '2025-01-15T22:27:16Z',
      taskState: 'active' as TaskState,
      sessionState: {
        status: 'working' as const,
        lastStateChange: '2025-01-15T22:50:00Z'
      },
      gitStatus: {
        ahead: 3,
        behind: 0,
        hasConflicts: false,
        staged: 2,
        unstaged: 1,
        untracked: 0
      },
      terminals: [/* 20+ lines of mock terminal data */]
    },
    // ... 3 more complete mock tasks (120+ lines total)
  ];

  private mockCommitHistory: CommitHistory[] = [
    // ... 4 mock commits with full metadata
  ];
}
```

### ProjectService Mock Planning Document
```typescript
export class ProjectService extends BaseService {
  private mockPlanningContent = `# Project Planning

## 🐛 Bugs
- [ ] Cart total not updating when quantity changes
- [ ] Login redirect loop on mobile Safari
- [ ] Memory leak in WebSocket connections

## 💡 Ideas
- [ ] Add dark mode toggle
- [ ] Implement offline support
- [ ] Add keyboard shortcuts
- [ ] Migrate to React 19 features

## 📋 Sprint Planning
### Current Sprint (Jan 15 - Jan 29)
- [x] Fix authentication issues
- [ ] Implement new dashboard
- [ ] Add unit tests for core modules

### Backlog
- Refactor legacy components
- Add integration tests
- Performance optimization
- Accessibility improvements`;
}
```

## Impact Analysis

### Developer Experience
- **High cognitive load**: Must mentally filter mock code
- **Slower code navigation**: Hard to find actual business logic
- **Review fatigue**: Mock changes pollute real changes in PRs

### Performance
- **Bundle size**: Mock data shipped to production
- **Memory usage**: Unnecessary object allocations
- **Build time**: More code to process

### Code Quality
- **Violates single responsibility**: Services handle both API calls AND mock data
- **Hard to test**: Mock logic mixed with production logic
- **Difficult refactoring**: Changes affect both concerns

## Proposed Solution

### Phase 1: Extract Mock Data Files
Create dedicated mock files per service:

```
/frontend/src/services/mocks/
├── git.mock.ts
├── task.mock.ts  
├── project.mock.ts
├── terminal.mock.ts
├── container.mock.ts
├── upload.mock.ts
├── settings.mock.ts
└── pull-request.mock.ts
```

### Phase 2: Clean Service Interfaces
Services focus only on API interactions:

```typescript
// git.service.ts - Production focused
export class GitService extends BaseService {
  async getGitStatus(projectId: string, taskId: string): Promise<GitStatus> {
    if (this.isMockEnabled) {
      const { mockGitStatus } = await import('./mocks/git.mock');
      return { ...mockGitStatus };
    }
    
    return this.get<GitStatus>(`/projects/${projectId}/tasks/${taskId}/git/status`);
  }
}
```

### Phase 3: Conditional Mock Loading
```typescript
// mocks/git.mock.ts - Development only
export const mockGitStatus: GitStatus = {
  clean: false,
  ahead: 2,
  behind: 0,
  filesChanged: 3,
  branch: 'feature/test-branch',
  upToDate: false
};

export const mockFiles: DiffFile[] = [
  // All mock file data here
];
```

## Implementation Strategy

### Step 1: Create Mock Data Modules
- Extract all mock data to separate files
- Use dynamic imports to avoid bundling in production
- Maintain same mock behavior

### Step 2: Update Service Classes  
- Remove inline mock data
- Use conditional imports for mock mode
- Keep same public interfaces

### Step 3: Verify No Behavior Changes
- All existing functionality must work identically
- Mock mode should behave exactly the same
- Production builds should exclude mock files

### Step 4: Bundle Analysis
- Verify mock data not included in production builds
- Measure bundle size reduction
- Confirm no performance regression

## Benefits

### Code Quality
- **Single responsibility**: Services focus on API logic only
- **Cleaner code**: Production logic not polluted with test data
- **Better readability**: Easier to understand actual business logic

### Maintainability  
- **Separated concerns**: Mock changes don't affect production code
- **Easier debugging**: Clear separation between real and mock behavior
- **Simpler testing**: Mock data in predictable locations

### Performance
- **Smaller bundles**: Mock data excluded from production
- **Faster builds**: Less code to process and optimize
- **Reduced memory**: No unnecessary mock objects in production

### Developer Experience
- **Faster code review**: Mock changes clearly separated
- **Better navigation**: Business logic easier to find
- **Cleaner diffs**: Production changes not mixed with mock updates

## Dependencies
- None - this is a pure refactoring effort

## Testing Strategy
1. **Behavior preservation**: All current functionality must work identically
2. **Mock mode testing**: Verify development experience unchanged  
3. **Production builds**: Confirm mock data excluded
4. **Bundle analysis**: Measure size improvements

## Priority: High
This affects every frontend service and significantly impacts developer productivity and code quality. Should be prioritized before major feature work.

## Estimated Effort: 3-4 days
- Day 1: Extract mock data files for Git/Task/Project services
- Day 2: Extract remaining service mock data  
- Day 3: Update service classes and conditional imports
- Day 4: Testing, bundle analysis, and verification

## Related Issues
- **BUG-016**: Remove Mock Code from Production (similar pattern in old api.ts)
- **Architecture**: Supports deep module principle by hiding mock complexity

## Filed: 2025-08-03