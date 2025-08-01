# BUG-007: git.service.js needs modularization

## Issue
The `git.service.js` file has grown to 985 lines with 32+ public methods in the GitService class, creating a shallow module that violates Ousterhout's deep module principle. The interface is far too complex - it should expose 4-5 high-level operations instead of dozens of low-level git commands.

## Current Problems
1. **Mixed paradigms**: Exports both standalone functions and a class that wraps the same functions
2. **God object anti-pattern**: GitService class handles 9+ different domains:
   - Basic git commands
   - Authentication/credentials
   - Status checking
   - Branch operations
   - Merge conflict detection
   - Worktree management
   - Commit history
   - File staging/unstaging
   - Push/pull operations
3. **Authentication logic scattered**: Complex token handling mixed with command execution (lines 14-94)
4. **Inconsistent error handling**: 
   - Some methods log, others fail silently
   - "Expected failures" use fragile string matching
   - Different return formats across methods
5. **Magic strings everywhere**: 
   - Hardcoded regex patterns for conflict parsing
   - Git porcelain format parsing with magic indices
   - Direct `/tmp/` path usage
6. **Duplicate code**: Many GitService methods are just thin wrappers calling standalone functions

## Impact
- Confusing API surface (which should I use - function or class method?)
- Hard to test individual git operations
- Authentication bugs affect all operations
- Difficult to mock for testing
- High risk of breaking changes when modifying
- Poor code reuse across the codebase

## Proposed Solution
Split into focused, single-responsibility services:

```
backend/services/git/
├── GitCommandExecutor.js      # ~60 lines - basic command execution
├── GitAuthService.js          # ~80 lines - credentials & tokens
├── GitStatusService.js        # ~150 lines - status, diffs, staging
├── GitBranchService.js        # ~120 lines - branches, commits
├── GitMergeService.js         # ~200 lines - merge conflicts
├── GitWorktreeService.js      # ~100 lines - worktree operations
├── GitError.js                # ~30 lines - custom error types
├── constants.js               # ~40 lines - patterns, formats
└── index.js                   # ~50 lines - main GitService facade
```

## Specific Refactorings

### 1. GitCommandExecutor
- Core `execute()` method
- Command sanitization
- Environment setup
- Process management

### 2. GitAuthService
```javascript
class GitAuthService {
  constructor(token) {
    this.token = token;
  }
  
  prepareEnvironment() { /* returns env vars */ }
  authenticateUrl(url) { /* adds token to URL */ }
  configureCredentialHelper(projectPath) { /* sets up gh auth */ }
}
```

### 3. Custom Error Types
```javascript
class GitError extends Error {
  constructor(message, type, isExpected = false) {
    super(message);
    this.type = type; // 'auth', 'merge', 'notfound', etc.
    this.isExpected = isExpected;
  }
}

// Replace string matching with:
if (error instanceof GitError && error.isExpected) {
  console.info(...);
}
```

### 4. Extract Constants
```javascript
// git/constants.js
export const GIT_FORMATS = {
  PORCELAIN_INDEX: 0,
  PORCELAIN_WORKING: 1,
  PORCELAIN_PATH_START: 3
};

export const CONFLICT_PATTERNS = {
  MERGE_TREE: /CONFLICT.*:\s+.*?\s+in\s+(.+)/g,
  STAGE_MARKER: /^\d{6}\s+\w{40}\s+[123]\t/
};

export const TEMP_DIR = process.env.GIT_TEMP_DIR || '/tmp';
```

### 5. Standardize Returns
All methods return consistent `GitResult`:
```javascript
{
  success: boolean,
  data: any,      // The actual result
  error?: Error   // Only if success is false
}
```

### 6. Facade Pattern
Main GitService becomes a thin facade:
```javascript
export class GitService {
  constructor(projectPath, token) {
    this.executor = new GitCommandExecutor(projectPath);
    this.auth = new GitAuthService(token);
    this.status = new GitStatusService(this.executor);
    this.branch = new GitBranchService(this.executor);
    this.merge = new GitMergeService(this.executor);
    this.worktree = new GitWorktreeService(this.executor);
  }
}
```

## Success Criteria
- [ ] No file over 200 lines
- [ ] Single responsibility per service
- [ ] Consistent error handling with custom types
- [ ] All magic values extracted to constants
- [ ] One clear API pattern (class-based only)
- [ ] Each service independently testable
- [ ] Total line reduction of ~28% through DRY principles

## Priority
High - Not just about file size, but about interface complexity. 32+ public methods should be 4-5 deep operations like `synchronize()`, `analyzeChanges()`, `performCommit()`. This shallow interface forces every caller to understand git internals.

## Estimated Impact
- Current: 985 lines in one file
- After: ~800 lines across 9 focused files
- Improved testability
- Reduced coupling
- Easier debugging of git-related issues

## Related
- Part of the "Marie Kondo" cleanup initiative
- Will improve reliability of git operations across all features
- Makes it easier to add new git functionality