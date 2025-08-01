# BUG-004: project.controller.js needs modularization

## Issue
The `backend/controllers/project.controller.js` file has grown to 1117 lines, making it difficult to maintain and understand. This violates the single responsibility principle and makes the codebase harder to work with.

## Current Problems
1. **File too large**: 1117 lines in a single controller file
2. **Mixed responsibilities**: Handles CRUD, Git operations, GitHub API, file system, and caching
3. **Repeated patterns**: Similar error handling and validation code duplicated across functions
4. **19 exported functions**: All crammed into one file with no logical separation
5. **Hard to test**: Difficult to mock dependencies or test individual features

## Impact
- Difficult to find specific functionality
- Higher chance of merge conflicts when multiple developers work on project features
- Harder to understand the code flow
- Increased cognitive load when debugging

## Proposed Solution
Split the controller into domain-specific modules:

```
backend/controllers/
├── project/
│   ├── index.js                 # Main exports
│   ├── crud.controller.js       # Basic CRUD operations (~200 lines)
│   ├── git.controller.js        # Git operations (~400 lines)
│   ├── planning.controller.js   # Planning file operations (~150 lines)
│   └── dashboard.controller.js  # Dashboard & status (~250 lines)
└── shared/
    ├── validation.js            # Common validation
    ├── responses.js             # Response helpers
    └── project-helpers.js       # Project lookup utilities
```

## Functions to Redistribute

### crud.controller.js
- listProjects
- createProject
- getProject
- updateProject
- deleteProject

### git.controller.js
- createBranch
- listBranches
- syncProject
- fetchProject
- pullBaseBranch
- pushBaseBranch

### planning.controller.js
- getProjectPlanning
- updateProjectPlanning

### dashboard.controller.js
- getBaseBranchStatus
- getUpdateStatus
- getProjectMinimal
- getProjectDashboardCached
- refreshProjectStatus
- getProjectDashboard

## Success Criteria
- [ ] No controller file exceeds 400 lines
- [ ] Clear separation of concerns
- [ ] Shared helpers eliminate code duplication
- [ ] All existing tests continue to pass
- [ ] Router imports updated to use new structure

## Priority
Medium - This is technical debt that impacts developer productivity but doesn't break functionality

## Related
- Part of the "Marie Kondo" cleanup initiative
- Similar refactoring needed for task.controller.js (965 lines)