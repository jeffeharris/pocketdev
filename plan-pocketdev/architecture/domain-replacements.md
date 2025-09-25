# Domain Objects - What They Replace

<!-- Document Metadata
Created: 2025-09-14
Modified: 2025-09-14
Status: active
-->


## GitStatus Domain Object Replacements

### Before: Scattered Conditions
```javascript
// Old way - checking multiple conditions manually
if (status.hasChanges && !status.isClean) {
  throw new Error('Cannot update: You have uncommitted changes');
}

if (status.ahead > 0 && status.behind === 0 && !hasConflicts) {
  // Can push
}

if (filesChanged === 0 && ahead === 0 && behind === 0) {
  // Is clean
}
```

### After: Domain Methods
```javascript
// New way - domain object knows the rules
if (!status.gitStatus.canPull()) {
  throw new Error(`Cannot update: ${status.gitStatus.getSummary()}`);
}

if (status.gitStatus.canPush()) {
  // Can push
}

if (status.gitStatus.isClean()) {
  // Is clean
}
```

## What's Actually Using Domain Objects Now

### 1. GitService (`/backend/services/git.service.js`)
- ✅ `getStatus()` creates and returns GitStatus domain object
- ✅ Adds convenient methods to response: `isClean`, `canMerge`, `canPush`, `recommendedAction`
- **Used by**: GitStatusMonitor, TaskGitOperations, any code calling getStatus()

### 2. TaskGitOperations (`/backend/services/internal/task-git-operations.js`)
- ✅ `pullUpdates()` now uses `gitStatus.canPull()` instead of manual checks
- ✅ Error messages use `gitStatus.getSummary()` for better descriptions
- **Replaces**: Manual checking of `hasChanges && !isClean`

### 3. GitStatusMonitor (`/backend/git-status-monitor.js`)
- ✅ Gets GitStatus domain object from `gitService.getStatus()`
- ✅ Status object includes all domain methods
- **Could improve**: Use domain methods for status comparison instead of manual key building

### 4. WorktreeService (`/backend/services/worktree.service.js`)
- ✅ `create()` validates with Worktree domain object
- ✅ `checkHealth()` uses domain rules for repair/checkout decisions
- **Replaces**: Manual path validation and state checking

### 5. ProjectService & TaskService
- ✅ Use domain objects for validation in `create()` methods
- **Replaces**: Manual validation like `if (!name || !branch)`

## What Could Be Further Simplified

### 1. Status Key Generation (GitStatusMonitor)
**Current:**
```javascript
const statusKey = `${status.ahead}-${status.behind}-${status.filesChanged}-${status.staged}-${status.unstaged}-${status.untracked}`;
```

**Could be:**
```javascript
const statusKey = status.gitStatus.getSummary(); // Already unique per state
```

### 2. Merge Conflict Detection
**Current:**
```javascript
if (mergeResult.output && mergeResult.output.includes('CONFLICT')) {
  // Has conflicts
}
```

**Could be:**
```javascript
const postMergeStatus = await gitService.getStatus(path);
if (postMergeStatus.gitStatus.hasConflicts()) {
  // Has conflicts - domain object detects it
}
```

### 3. Can Merge Logic (Throughout)
**Current:** Various places check different combinations
**Could be:** Always use `gitStatus.canMerge()` which encapsulates all rules

## Benefits Already Realized

1. **Clearer Intent**: `canPull()` is self-documenting vs `hasChanges && !isClean`
2. **Consistent Rules**: Domain object ensures same logic everywhere
3. **Better Messages**: `getSummary()` provides human-readable status
4. **Recommended Actions**: UI can show what to do next
5. **Validation**: Domain constructors prevent invalid states

## Summary

The domain objects are actively being used and have replaced:
- Manual validation in service create methods
- Scattered git status checks in TaskGitOperations
- Manual path validation in WorktreeService

They're providing value through:
- Business rule encapsulation (canMerge, canPull, etc.)
- Consistent validation
- Self-documenting code
- Better error messages

The integration is working - existing code gets the benefits without breaking changes!