# Backend Services Design Review

## DESIGN ANALYSIS SUMMARY

The backend services directory contains 20 service modules attempting to encapsulate business logic away from controllers. While the intent to create a service layer is commendable, the implementation severely violates Ousterhout's principles of deep modules and complexity management. Most services are shallow modules with overly complex interfaces that barely hide any implementation complexity. The codebase suffers from unclear abstraction boundaries, excessive method counts, and leaky abstractions throughout.

The most egregious example is `git.service.js` with 986 lines and over 40 public methods - a textbook case of interface complexity exceeding implementation complexity. This pattern repeats across multiple services, creating a cognitive burden that compounds rather than reduces system complexity.

## CRITICAL ISSUES

### 1. Git Service: Catastrophic Interface Complexity
**Principle violated**: Deep modules (simple interface, complex implementation)  
**Problem**: GitService exposes 40+ methods including both standalone functions and class methods, creating massive interface complexity. The file is 986 lines with methods ranging from low-level command execution to high-level operations.  
**Impact**: Developers must understand dozens of methods to use git functionality. The cognitive load is enormous and the abstraction provides minimal value over direct git commands.  
**Recommended fix**: Split into 3-4 deep modules:
- `GitCommandExecutor` (3 methods: execute, executeWithAuth, batchExecute)
- `GitWorkflowService` (5 methods: commit, push, pull, merge, createPR)
- `GitInspectionService` (5 methods: getStatus, getDiff, getBranchInfo, getHistory, checkConflicts)

### 2. Service Registry: Circular Dependency Nightmare
**Principle violated**: Define errors out of existence  
**Problem**: The ServiceRegistry in `index.js` has complex dependency resolution logic that handles circular dependencies, special cases for models, and app.locals bridging. This creates fragile initialization order dependencies.  
**Impact**: Adding new services requires understanding the entire dependency graph. Circular dependencies can cause runtime failures that are hard to debug.  
**Recommended fix**: Eliminate circular dependencies by:
- Injecting interfaces instead of concrete services
- Using event-based communication instead of direct service calls
- Creating a proper dependency injection container with explicit lifecycle management

### 3. Terminal Service: Mixed Abstraction Levels
**Principle violated**: Different layer, different abstraction  
**Problem**: TerminalService mixes high-level business operations (createSession, deleteSession) with low-level implementation details (Shelltender API calls, session ID mapping, monitor coordination).  
**Impact**: Changes to Shelltender API ripple through business logic. The service is tightly coupled to infrastructure.  
**Recommended fix**: Create layers:
- `TerminalRepository` (handles Shelltender API and ID mapping)
- `TerminalService` (business operations only, 5-6 methods max)
- `TerminalMonitor` (handles real-time state tracking)

### 4. EventEmitter Service: Shallow Wrapper Anti-Pattern
**Principle violated**: Deep modules  
**Problem**: EventEmitterService has 30+ emit methods that are simple wrappers around the base emit function. Each method like `emitTaskCreated(data)` just calls `emit('task.created', {task: data})`.  
**Impact**: The interface is nearly as complex as not having the service at all. Developers must learn dozens of method names that provide no abstraction value.  
**Recommended fix**: Replace with a single emit method that takes event type and data. Use constants for event names:
```javascript
class EventBus {
  emit(eventType, data) { /* implementation */ }
  subscribe(eventType, handler) { /* implementation */ }
}
// Usage: eventBus.emit(EventTypes.TASK_CREATED, taskData)
```

## HIGH PRIORITY IMPROVEMENTS

### 1. WebSocket Service: Inappropriate Responsibility
**Principle violated**: Single responsibility  
**Problem**: WebSocketService is responsible for both WebSocket connection management AND subscribing to domain events. It has 180+ lines of event subscription setup.  
**Impact**: Adding new events requires modifying the WebSocket service. The service knows too much about the domain.  
**Recommended fix**: 
- Move event subscriptions to a separate `WebSocketEventBridge` class
- WebSocketService should only handle connection management and broadcasting
- Use a declarative event mapping configuration

### 2. Task Service: Hidden Complexity Not Pushed Down
**Principle violated**: Pull complexity downward  
**Problem**: TaskService exposes complex parameters and options in methods like `createTask()` which takes projectId, taskData, githubToken, and options objects.  
**Impact**: Callers must understand and provide multiple parameters for common operations.  
**Recommended fix**: Create task through the project:
```javascript
const project = await projectService.get(projectId);
const task = await project.createTask(name, branch); // Token handled internally
```

### 3. Worktree Service: Leaky File System Abstraction
**Principle violated**: Information hiding  
**Problem**: WorktreeService exposes file system paths and git implementation details. Methods like `cleanupOrphaned()` return arrays of removed paths.  
**Impact**: Callers become coupled to file system layout and git worktree implementation.  
**Recommended fix**: Hide paths behind opaque identifiers. Return success/failure rather than implementation details.

### 4. Session ID Chaos Propagation
**Principle violated**: Define errors out of existence  
**Problem**: Multiple services deal with the complexity of three different session ID types (sessionId, dbSessionId, shelltenderSessionId).  
**Impact**: Every service touching sessions must handle ID resolution, creating widespread complexity.  
**Recommended fix**: Create a single `SessionIdentifier` value object that encapsulates all ID types and provides a unified interface.

## MEDIUM PRIORITY SUGGESTIONS

### 1. Upload Service: Premature Abstraction
**Principle violated**: Don't create unnecessary abstractions  
**Problem**: UploadService is a thin wrapper around file operations with methods that barely hide any complexity.  
**Impact**: Additional layer without meaningful abstraction benefit.  
**Recommended fix**: Either make it a deep module by adding complex features (virus scanning, image optimization, CDN upload) or eliminate it.

### 2. Monitoring Service: Too Many Concerns
**Principle violated**: Single responsibility  
**Problem**: MonitoringService handles metrics collection, alerting, API monitoring, session monitoring, and health checks.  
**Impact**: Changes to any monitoring aspect require modifying the entire service.  
**Recommended fix**: Split into focused services: MetricsCollector, HealthChecker, AlertManager.

### 3. Settings Service: Shallow CRUD Wrapper
**Principle violated**: Deep modules  
**Problem**: SettingsService provides simple get/set methods that barely abstract the database.  
**Impact**: No real value over direct database access.  
**Recommended fix**: Either add complex features (validation, type conversion, change notifications) or remove the abstraction.

### 4. Container Service: Infrastructure Leak
**Principle violated**: Information hiding  
**Problem**: ContainerService exposes Docker implementation details like container IDs and port mappings.  
**Impact**: Business logic becomes coupled to Docker specifics.  
**Recommended fix**: Abstract behind business concepts like "development environment" rather than "containers".

## POSITIVE OBSERVATIONS

### 1. EventEmitterService Core Design
The core event-based architecture using EventEmitter is sound. The publish-subscribe pattern correctly decouples services. The hierarchical event naming (e.g., 'task.created') is well-structured.

### 2. Service Registry Concept
The attempt to create a central service registry shows good architectural thinking. While the implementation has issues, the concept of managed service lifecycle is valuable.

### 3. Terminal Service Session Abstraction
Despite mixing abstraction levels, TerminalService successfully hides some complex session management details like Shelltender reconnection logic and monitor coordination.

### 4. Git Service Credential Management
The Git credential management using environment variables and auth tokens is well-implemented, properly handling the complexity of GitHub authentication.

## REFACTORING ROADMAP

### Phase 1: Stabilize Critical Services (Week 1-2)
1. **Extract Git mega-service** into focused modules:
   - Create GitCommandExecutor for low-level operations
   - Create GitWorkflowService for high-level workflows
   - Create GitInspectionService for read operations
   - Deprecate but maintain backward compatibility

2. **Simplify EventEmitterService**:
   - Replace 30+ emit methods with single parameterized emit
   - Create EventTypes constant module
   - Update all callers gradually

3. **Fix Service Registry circular dependencies**:
   - Map current dependency graph
   - Break circles by introducing interfaces
   - Add dependency validation

### Phase 2: Create Deep Modules (Week 3-4)
1. **Refactor TerminalService layers**:
   - Extract TerminalRepository for Shelltender API
   - Keep TerminalService for business logic only
   - Create TerminalMonitor for real-time tracking

2. **Unify Session ID handling**:
   - Create SessionIdentifier value object
   - Update all services to use unified identifier
   - Hide ID complexity inside the value object

3. **Simplify WebSocketService**:
   - Extract WebSocketEventBridge
   - Move subscriptions to configuration
   - Reduce WebSocketService to connection management

### Phase 3: Eliminate Shallow Modules (Week 5-6)
1. **Evaluate each shallow service**:
   - UploadService: Add complex features or remove
   - SettingsService: Add validation/typing or remove
   - Merge similar services (various git-*.service.js files)

2. **Push complexity downward**:
   - Simplify service method signatures
   - Move options/configuration inside services
   - Provide sensible defaults

### Phase 4: Infrastructure Abstraction (Week 7-8)
1. **Hide infrastructure details**:
   - Abstract Container Service behind business concepts
   - Hide file paths in Worktree Service
   - Create proper repository pattern for data access

2. **Establish clear boundaries**:
   - Document which services can call which
   - Enforce boundaries with linting rules
   - Create architectural decision records

### Success Metrics
- No service with more than 10 public methods
- Average service interface complexity < 25% of implementation
- Zero circular dependencies
- All infrastructure details hidden behind abstractions
- 50% reduction in total service methods

### Implementation Notes
- Maintain backward compatibility during refactoring
- Write tests before refactoring critical services
- Update documentation as modules are refactored
- Use feature flags for gradual rollout
- Monitor error rates during transition

The current service layer attempts to reduce complexity but instead redistributes it across many shallow modules. By creating truly deep modules with simple interfaces hiding complex implementations, the codebase can achieve the original goal of manageable complexity. The refactoring roadmap provides a path from the current state to a well-designed service architecture that follows Ousterhout's principles.