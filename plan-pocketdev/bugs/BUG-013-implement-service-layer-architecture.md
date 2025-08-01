# BUG-013: Implement Service Layer Architecture

## Summary
Controllers throughout the codebase are performing service-level work, directly executing git commands, managing file systems, and handling business logic. This violates Ousterhout's principle of different layers having different abstractions.

## Current State
- Controllers mix HTTP concerns with business logic
- No clear service layer between controllers and models
- Direct git command execution in controllers
- Business logic scattered across multiple files

## Problems Identified
1. **Mixed abstraction levels**: HTTP handling mixed with git operations
2. **Poor testability**: Can't test business logic without HTTP context
3. **Code duplication**: Similar patterns repeated across controllers
4. **Tight coupling**: Controllers know too much about implementation

## Code Examples
```javascript
// task.controller.js - Controller doing too much
async createTask(req, res) {
  // HTTP concern
  const { name, branch } = req.body;
  
  // Business logic that should be in service
  const worktreePath = path.join(projectPath, 'worktrees', taskId);
  await gitService.createWorktree(projectPath, worktreePath, branch);
  
  // Database operation
  const task = await models.tasks.create({...});
  
  // External service integration
  const sessionId = await createTaskSession(task.id, worktreePath);
  
  // WebSocket notification
  req.app.locals.wsEventService.broadcast('task-created', task);
  
  // HTTP response
  res.json(task);
}
```

## Proposed Solution
Implement proper service layer:

```javascript
// Controllers handle only HTTP
async createTask(req, res) {
  try {
    const task = await taskService.createTask(
      req.params.projectId,
      req.body
    );
    res.json({ success: true, task });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
}

// Services handle business logic
class TaskService {
  async createTask(projectId, data) {
    const task = await this.initializeTask(projectId, data);
    await this.setupWorkEnvironment(task);
    await this.notifyCreation(task);
    return task;
  }
}
```

## Implementation Steps
1. Create `/backend/services/` directory structure
2. Extract business logic from controllers into services:
   - `TaskService` - Task lifecycle management
   - `ProjectService` - Project operations
   - `GitOperationService` - Git command orchestration
3. Update controllers to use services
4. Implement dependency injection pattern
5. Add service layer tests

## Benefits
- **Separation of concerns**: Clear boundaries between layers
- **Testability**: Business logic can be tested without HTTP
- **Reusability**: Services can be used by different controllers
- **Maintainability**: Changes isolated to appropriate layer

## Priority: Critical
This architectural issue affects every feature addition and makes the codebase increasingly difficult to maintain.

## Estimated Effort: 3-5 days

## Filed: 2025-08-01