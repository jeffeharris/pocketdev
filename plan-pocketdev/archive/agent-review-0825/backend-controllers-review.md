# Backend Controllers Design Review - Ousterhout Analysis

<!-- Document Metadata
Created: 2025-08-03
Modified: 2025-08-03
Status: ????
-->


## DESIGN ANALYSIS SUMMARY

The backend controllers exhibit classic symptoms of shallow module design with leaky abstractions. Controllers are doing business logic, handling complex git operations, managing state updates, and coordinating between multiple services - violating the single responsibility principle. The most problematic issue is the mixing of abstraction layers: transport concerns (HTTP) are deeply intertwined with business logic and infrastructure concerns. This creates unnecessary cognitive load and makes the code difficult to test, maintain, and reason about.

## CRITICAL ISSUES

### 1. God Controller Anti-Pattern in TaskController
**Principle violated**: Deep modules, Single responsibility
**Problem**: TaskController has 16+ public methods handling everything from CRUD to git operations to WebSocket coordination
**Impact**: New developers must understand the entire system to make simple changes. Testing requires complex mocks. Changes ripple across unrelated features.
**Recommended fix**: Extract into focused controllers: TaskCRUDController (basic operations), TaskLayoutController (split views), TaskMergeController (merge logic)

### 2. Business Logic in Controllers
**Principle violated**: Different layer, different abstraction
**Problem**: Controllers contain complex business logic (e.g., merge operations, git status checks, file system operations)
**Impact**: Cannot reuse business logic, difficult to test, violates MVC pattern
**Recommended fix**: Move all business logic to service layer. Controllers should only handle: request validation, service delegation, response formatting

### 3. Global State Dependency via app.locals
**Principle violated**: Information hiding, Define errors out of existence  
**Problem**: Controllers access global state through req.app.locals (wsAdapter, aiMonitor, models, etc.)
**Impact**: Hidden dependencies, difficult to test, unclear initialization order, potential race conditions
**Recommended fix**: Use dependency injection. Pass dependencies explicitly through constructor or method parameters.

### 4. Leaky Git Abstractions
**Principle violated**: Information hiding, Pull complexity downward
**Problem**: Controllers directly manipulate git commands, understand worktree paths, handle merge conflicts
**Impact**: Git implementation details leak throughout the codebase. Changing git strategy requires touching controllers.
**Recommended fix**: Create a deep GitFacade that exposes high-level operations like "mergeTask", "checkConflicts" without exposing git internals

## HIGH PRIORITY IMPROVEMENTS

### 1. Mixed Service Access Patterns
**Principle violated**: Design it twice
**Problem**: Some controllers use req.services.get('ServiceName'), others use req.app.locals, some mix both
**Impact**: Inconsistent patterns confuse developers, make refactoring harder
**Recommended fix**: Standardize on dependency injection pattern. All services injected via constructor.

### 2. Error Handling Inconsistency
**Principle violated**: Define errors out of existence
**Problem**: Each controller handles errors differently - some use next(), some return status codes directly
**Impact**: Unpredictable error responses, difficult to implement global error handling
**Recommended fix**: Create error types (ValidationError, NotFoundError) and let middleware handle response formatting

### 3. Request/Response Logic Mixed with Business Logic
**Principle violated**: Different layer, different abstraction
**Problem**: Controllers parse request bodies, construct complex responses, and perform business logic
**Impact**: Cannot reuse business logic outside HTTP context, difficult to add CLI or WebSocket interfaces
**Recommended fix**: Controllers should be thin adapters: parse request → call service → format response

### 4. Shallow Module Design in ProjectController
**Principle violated**: Deep modules
**Problem**: 12 public methods that are mostly pass-through to git service
**Impact**: Controller adds no value, just increases complexity
**Recommended fix**: Combine related operations (e.g., syncProject could handle fetch + pull + status)

## MEDIUM PRIORITY SUGGESTIONS

### 1. Implicit State Updates
**Principle violated**: Information hiding
**Problem**: Controllers trigger side effects through various monitors and services without clear contracts
**Impact**: Difficult to understand full impact of operations, potential for missed updates
**Recommended fix**: Use event-driven architecture with clear event contracts

### 2. File System Path Manipulation
**Principle violated**: Pull complexity downward
**Problem**: Controllers construct file paths, check file existence, handle path operations
**Impact**: Platform-specific bugs, security vulnerabilities, scattered file system logic
**Recommended fix**: Encapsulate all file operations in a FileSystemService with safe path handling

### 3. Complex Conditional Logic
**Principle violated**: Design it twice
**Problem**: Deep nesting for error conditions, special cases for Claude assistance, merge operations
**Impact**: High cyclomatic complexity, difficult to test all paths
**Recommended fix**: Extract complex flows into dedicated workflow services with clear steps

### 4. Response Format Inconsistency
**Principle violated**: Different layer, different abstraction
**Problem**: Each endpoint formats responses differently - some return { success, data }, others return data directly
**Impact**: Frontend must handle multiple response formats, API inconsistency
**Recommended fix**: Standardize response envelope format across all endpoints

## POSITIVE OBSERVATIONS

1. **Service Registry Pattern**: The move towards req.services.get() shows recognition of dependency issues
2. **Separation of Git Controllers**: TaskGitController shows attempt to separate concerns
3. **Clear HTTP Verb Usage**: RESTful design is generally well-implemented
4. **Validation Presence**: Most controllers validate required parameters
5. **Async/Await Consistency**: Modern JavaScript patterns used throughout

## REFACTORING ROADMAP

### Phase 1: Establish Service Layer Foundation (Week 1)
1. Create ServiceRegistry with proper dependency injection
2. Move all business logic from TaskController to TaskService
3. Standardize error types and handling
4. Remove app.locals dependencies

### Phase 2: Deep Module Extraction (Week 2)
1. Create GitFacade to hide git complexity
2. Extract FileSystemService for path operations
3. Create WorkflowService for complex operations (merge with Claude)
4. Implement event bus for state updates

### Phase 3: Controller Simplification (Week 3)
1. Reduce each controller to <5 methods where possible
2. Standardize request/response handling
3. Remove all business logic from controllers
4. Implement consistent error handling middleware

### Phase 4: Testing and Documentation (Week 4)
1. Write unit tests for services (now possible without HTTP context)
2. Create integration tests for controllers
3. Document service contracts and events
4. Update API documentation

### Example Refactoring - TaskController.createTask

**Current (Shallow, Mixed Concerns):**
```javascript
async createTask(req, res) {
  const { projectId } = req.params;
  const { name, branch, useExistingBranch } = req.body;
  
  if (!name || !branch) {
    return res.status(400).json({ error: 'Task name and branch are required' });
  }
  
  try {
    const taskService = req.services.get('TaskService');
    const result = await taskService.createTask(projectId, { name, branch, useExistingBranch }, req.githubToken, { createSession: true, hostname: req.hostname });
    
    // Direct manipulation of monitors - leaky abstraction
    const sessionMonitor = req.app.locals.wsAdapter;
    const aiMonitor = req.app.locals.aiMonitor;
    if (sessionMonitor && aiMonitor && result.session?.sessionId) {
      try {
        await sessionMonitor.connectToSession(result.session.sessionId);
        await aiMonitor.registerSessionPatterns(result.session.sessionId);
      } catch (error) {
        console.warn('Failed to connect monitors:', error.message);
      }
    }
    
    res.json(result.task);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
```

**Refactored (Deep Module, Clear Separation):**
```javascript
class TaskController {
  constructor(taskService, eventBus) {
    this.taskService = taskService;
    this.eventBus = eventBus;
  }

  async createTask(req, res, next) {
    try {
      const task = await this.taskService.createTask(
        req.params.projectId,
        req.body,
        req.user.githubToken
      );
      
      // Let interested parties handle their own concerns
      this.eventBus.emit('task.created', { task, hostname: req.hostname });
      
      res.status(201).json(task);
    } catch (error) {
      next(error); // Let error middleware handle response
    }
  }
}
```

This refactoring demonstrates:
- **Deep module**: Simple interface hides complex task creation
- **Single responsibility**: Controller only handles HTTP concerns
- **Information hiding**: Monitor details hidden behind event bus
- **Error handling**: Consistent error propagation
- **Testability**: Can test without HTTP context or global state