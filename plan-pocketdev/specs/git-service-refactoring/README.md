# Git Service Refactoring Specification

## Overview
Complete refactoring of the monolithic GitService into deep modules following John Ousterhout's principles.

## Problem Statement
The original GitService was a god object with 32+ public methods, violating the deep module principle. It had a shallow interface nearly as complex as its implementation, creating high cognitive load.

## Solution Architecture

### Three Deep Modules
The monolithic GitService has been split into three focused modules based on git's conceptual model:

#### 1. GitRepository (5 methods)
Handles repository-level operations:
- `clone(url, destination)` - Clone a repository
- `fetch(workingDirectory, options)` - Fetch updates from remote
- `push(workingDirectory, branch, options)` - Push changes to remote
- `pull(workingDirectory, remote, branch)` - Pull changes from remote
- `getCurrentBranch(workingDirectory)` - Get current branch name

#### 2. GitWorkingTree (6 methods)
Handles working tree operations:
- `stage(workingDirectory, files)` - Stage files for commit
- `commit(workingDirectory, message)` - Commit staged changes
- `reset(workingDirectory, options)` - Reset working tree
- `getStatus(workingDirectory)` - Get working tree status
- `checkout(workingDirectory, branch, options)` - Switch branches
- `merge(workingDirectory, branch, message)` - Merge branches

#### 3. GitAnalyzer (5 methods)
Handles analysis and inspection operations:
- `getDiff(workingDirectory, options)` - Get diff information
- `checkMergeConflicts(workingDirectory, targetBranch)` - Check for conflicts
- `getUnpushedCommits(workingDirectory, branch)` - Get unpushed commits
- `getCommitHistory(workingDirectory, options)` - Get commit log
- `getFileChanges(workingDirectory, options)` - Get detailed file change information

### GitExecutor Base Class
An internal base class that provides common functionality:
- `execute(command, workingDirectory)` - Execute git commands
- `getEnv()` - Get environment with GitHub token

This class is not exported and exists purely to eliminate code duplication.

## Implementation Details

### Module Instantiation
Services no longer use dependency injection for git operations. Instead, they instantiate the specific modules they need:

```javascript
// Before (dependency injection)
async createTask(projectId, taskData, gitService, options) {
  await gitService.configureCredentials(worktreePath);
  const status = await gitService.getStatus(worktreePath);
}

// After (direct instantiation)
async createTask(projectId, taskData, githubToken, options) {
  const repository = new GitRepository(githubToken);
  const workingTree = new GitWorkingTree(githubToken);
  
  await configureGitCredentials(worktreePath, githubToken);
  const status = await workingTree.getStatus(worktreePath);
}
```

### No Facades or Compatibility Layers
The refactoring removes all facades and compatibility layers. There is no GitService class anymore - services must use the specific modules directly.

### File Structure
```
backend/services/
├── git-core.service.js         # Exports modules and utility functions
├── git-repository.service.js   # Repository operations module
├── git-workingtree.service.js  # Working tree operations module
├── git-analyzer.service.js     # Analysis operations module
└── git-executor.js             # Internal base class (not exported)
```

## Migration Guide

### For Services
1. Remove gitService parameter from method signatures
2. Accept githubToken instead
3. Import specific modules needed
4. Instantiate modules in methods as needed

### For Controllers
1. Pass githubToken instead of gitService to services
2. Remove any direct gitService usage
3. Use utility functions for simple operations

### For Tests
1. Mock specific modules instead of GitService
2. Update test expectations for new method signatures
3. Remove references to non-existent methods

## Benefits Achieved

### Deep Module Characteristics
- **Simple interfaces**: Each module has only 5-6 public methods
- **Hidden complexity**: Git command construction and execution hidden
- **Clear abstractions**: Repository vs WorkingTree vs Analyzer
- **Single responsibility**: Each module has one clear job

### Metrics
- **Before**: 32+ public methods in one class
- **After**: 16 total methods across 3 modules (5-6 each)
- **Interface reduction**: 50% fewer public methods
- **Cognitive load**: Can understand each module in <1 minute
- **Grade**: Improved from C+ to A- in Ousterhout code review

## Testing Approach
Each module can be tested in isolation:
- Repository tests focus on remote operations
- WorkingTree tests focus on local changes
- Analyzer tests focus on inspection operations

## Future Considerations
1. Consider creating higher-level orchestration services for complex workflows
2. Add input validation to GitExecutor for better error messages
3. Standardize return values across all methods for consistency

## References
- John Ousterhout's "A Philosophy of Software Design"
- Original bug report: BUG-007
- Ousterhout code review results

---

*Created: 2025-08-18*  
*Status: Implemented and Tested*