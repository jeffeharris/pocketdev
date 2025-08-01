# BUG-010: task.controller.js needs modularization

## Issue
The `task.controller.js` has grown to 965 lines with 17 public methods mixing git operations, sessions, websockets, and CRUD operations. This creates a shallow module where the interface is complex and implementation details leak throughout. The controller should be a thin HTTP layer but instead contains extensive business logic.

## Current Problems
1. **God controller anti-pattern**: Handles CRUD, git ops, worktrees, sessions, layouts, and merges
2. **Duplicate merge logic**: Both `mergeToBase` (153 lines) and `updateTask` (101 lines) handle Claude-assisted merges
3. **Mixed abstraction levels**: High-level operations mixed with low-level git commands
4. **Long methods**: Multiple methods over 100 lines
5. **Inconsistent patterns**: Some operations use GitService, others use direct commands
6. **Poor separation**: Git operations that should be in task-git.controller.js

## Impact
- Difficult to test individual operations
- High risk of breaking changes
- Duplicate code between methods
- Hard to maintain consistency
- Violates stated architecture

## Proposed Solution
Split into domain-specific controllers:

```
backend/controllers/
├── task.controller.js              # ~300 lines - CRUD only
├── task-git.controller.js          # ~400 lines - Git operations (already exists!)
├── task-merge.controller.js        # ~250 lines - Merge operations
├── task-session.controller.js      # ~150 lines - Terminal session management
└── task-layout.controller.js       # ~100 lines - Split view layouts
```

### Refactoring Plan

#### 1. Move to task-git.controller.js
These methods belong in the existing git controller:
- `checkMergeConflicts` (lines 692-714)
- `updateTask` (lines 586-687) - the git update part
- `_checkMergeStatus` (lines 876-924)

#### 2. Create task-merge.controller.js
Extract merge-specific operations:
```javascript
export class TaskMergeController {
  async mergeToBase(req, res) { /* lines 719-872 */ }
  async createMergeTask(task, project, options) { /* extracted helper */ }
  async performDirectMerge(task, project, gitService) { /* extracted helper */ }
  async writeMergePrompt(worktreePath, options) { /* extracted helper */ }
}
```

#### 3. Create task-session.controller.js
Extract session management:
```javascript
export class TaskSessionController {
  async cleanupTaskSessions(taskId) { /* lines 929-965 */ }
  async getTaskSessions(req, res) { /* new endpoint */ }
  async createTaskSession(req, res) { /* extracted from createTask */ }
}
```

#### 4. Create task-layout.controller.js
Extract split view operations:
```javascript
export class TaskLayoutController {
  async getSplitLayout(req, res) { /* lines 402-429 */ }
  async updateSplitLayout(req, res) { /* lines 434-488 */ }
}
```

#### 5. Simplify task.controller.js
Keep only core CRUD operations:
- `createTask` (simplified)
- `listTasks` / `listTasksMinimal`
- `getTask` (simplified)
- `updateTaskMetadata`
- `deleteTask` / `checkDelete`

#### 6. Extract Common Patterns
Create service layer for shared logic:
```javascript
// services/task-operations.service.js
export class TaskOperationsService {
  async triggerStatusUpdate(taskId, app) { /* lines 28-34 */ }
  async enrichTaskWithGitStatus(task, gitService, baseBranch) { /* extracted */ }
  async getTaskWithFullStatus(task, project, gitService) { /* extracted */ }
}
```

## Example Refactored Method
Before (mixed concerns):
```javascript
async updateTask(req, res) {
  // 101 lines mixing:
  // - Parameter validation
  // - Git status checking
  // - Claude task creation
  // - Direct git operations
  // - Database updates
  // - WebSocket events
}
```

After (single responsibility):
```javascript
// In task.controller.js
async updateTask(req, res) {
  const { taskId } = req.params;
  const task = await this.validateTaskAccess(taskId, req);
  
  if (req.body.withClaude) {
    return this.mergeController.createClaudeAssistedUpdate(req, res, task);
  }
  
  return this.gitController.updateTaskBranch(req, res, task);
}
```

## Success Criteria
- [ ] task.controller.js reduced to ~300 lines
- [ ] Each controller has single responsibility
- [ ] No duplicate merge logic
- [ ] Consistent abstraction levels
- [ ] All git operations use GitService
- [ ] Methods under 50 lines each

## Priority
High - Core backend architecture that affects maintainability

## Related
- Follows the pattern established by having separate task-git.controller.js
- Part of the "Marie Kondo" cleanup initiative
- Will make testing much easier