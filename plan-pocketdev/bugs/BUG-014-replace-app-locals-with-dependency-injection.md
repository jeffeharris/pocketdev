# BUG-014: Replace app.locals with Dependency Injection

## Summary
The backend uses `app.locals` as a global service locator, violating Ousterhout's information hiding principle. This creates implicit dependencies and makes testing difficult.

## Current State
- **Pattern**: Services stored in `app.locals` throughout `/backend/server.js`
- **Access**: Controllers access via `req.app.locals.serviceName`
- **Problems**: Hidden dependencies, difficult testing, no lifecycle management

## Problems Identified
1. **Global state anti-pattern**: Any code can access any service
2. **Hidden dependencies**: Not clear what services a controller needs
3. **Testing complexity**: Must mock entire Express app structure
4. **No type safety**: Services accessed via strings

## Code Examples
```javascript
// Current anti-pattern in server.js
app.locals.models = models;
app.locals.db = db;
app.locals.projectsDir = config.projectsDir;
app.locals.githubTokenService = githubTokenService;
app.locals.sessionCleanupService = sessionCleanupService;
app.locals.aiMonitor = aiMonitor;
app.locals.notificationService = notificationService;
app.locals.wsClient = wsClient;
app.locals.wsAdapter = sessionMonitor;
app.locals.gitStatusMonitor = gitStatusMonitor;

// Accessed in controllers like:
const models = req.app.locals.models;
const github = req.app.locals.github;
```

## Proposed Solution
Implement proper dependency injection:

```javascript
// ServiceContainer.js
class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
  }
  
  register(name, factory, options = {}) {
    this.services.set(name, { factory, ...options });
  }
  
  get(name) {
    if (!this.services.has(name)) {
      throw new Error(`Service ${name} not registered`);
    }
    // Handle singleton vs transient
    return this.resolve(name);
  }
}

// Controller with explicit dependencies
class TaskController {
  constructor(taskService, notificationService) {
    this.taskService = taskService;
    this.notificationService = notificationService;
  }
  
  async createTask(req, res) {
    const task = await this.taskService.create(req.body);
    await this.notificationService.notify('task-created', task);
    res.json(task);
  }
}
```

## Implementation Steps
1. Create `ServiceContainer` class
2. Register all services with proper lifecycle
3. Create controller factories that inject dependencies
4. Update route definitions to use controller instances
5. Remove all `app.locals` usage
6. Add TypeScript interfaces for better type safety

## Benefits
- **Explicit dependencies**: Clear what each component needs
- **Testability**: Easy to provide mock services
- **Type safety**: Can add TypeScript interfaces
- **Lifecycle management**: Proper initialization order

## Priority: High
While not blocking features, this significantly impacts code quality and testability.

## Estimated Effort: 2-3 days

## Filed: 2025-08-01