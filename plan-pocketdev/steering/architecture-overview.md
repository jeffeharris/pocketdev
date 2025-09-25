# PocketDev Architecture Overview

<!-- Document Metadata
Created: 2025-08-01
Modified: 2025-09-12
Status: active
-->


This document provides a comprehensive view of PocketDev's architecture after the v2.0.0 service layer transformation.

## Current Architecture (v2.0.0)

### System Overview
```
┌─────────────────────┐         ┌─────────────────────┐         ┌──────────────────┐
│  Frontend           │  HTTP   │  Backend API        │         │  SQLite DB       │
│  (React/Vite)       │────────▶│  (Express)          │────────▶│                  │
│  Port 5173          │         │  Port 3005          │         └──────────────────┘
│                     │         │                     │
│  ┌───────────────┐  │         │  ┌───────────────┐  │
│  │Service Layer  │  │         │  │Service Layer  │  │
│  │- 8 Services   │  │         │  │- 10 Services  │  │
│  │- BaseService  │  │         │  │- DI Registry  │  │
│  │- Mock Support │  │         │  │- Event-Driven │  │
│  └───────────────┘  │         │  └───────────────┘  │
└─────────────────────┘         └─────────────────────┘
         │                                │
         │                                └─── HTTP/WS ─────────────┐
         │                                                          │
         └────────── WebSocket ─────────────────────────────────────┼───┐
                                                                    │   │
                                                           ┌────────▼───▼────┐
                                                           │  Shelltender    │
                                                           │  Port 8080      │
                                                           └─────────────────┘
```

### Service Layer Architecture

#### Backend Services (10 + Infrastructure)
```
┌─────────────────────────────────────────────────────────────────┐
│                     Backend Service Layer                        │
├─────────────────────┬─────────────────────┬────────────────────┤
│  Domain Services    │  Infrastructure     │  Support Services   │
├─────────────────────┼─────────────────────┼────────────────────┤
│ • GitStatusService  │ • EventEmitter      │ • MonitoringService │
│ • GitOperationSvc   │ • WebSocketService  │ • SettingsService   │
│ • TaskService       │ • Closure-based DI  │ • UploadService     │
│ • ProjectService    │                     │ • ContainerService  │
│ • TerminalService   │                     │                     │
│ • PullRequestSvc    │                     │                     │
└─────────────────────┴─────────────────────┴────────────────────┘
```

#### Frontend Services (8 + Infrastructure)
```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend Service Layer                        │
├─────────────────────┬─────────────────────┬────────────────────┤
│  Domain Services    │  Infrastructure     │  Adapters          │
├─────────────────────┼─────────────────────┼────────────────────┤
│ • GitService        │ • BaseService       │ • SessionAdapter    │
│ • TaskService       │ • ServiceProvider   │                     │
│ • ProjectService    │ • Type System       │                     │
│ • TerminalService   │                     │                     │
│ • ContainerService  │                     │                     │
│ • PullRequestSvc    │                     │                     │
│ • SettingsService   │                     │                     │
│ • UploadService     │                     │                     │
└─────────────────────┴─────────────────────┴────────────────────┘
```

### Current Layer Responsibilities (v2.0.0)

#### Frontend Components
- **Does**: UI rendering, user interactions, calling services
- **Doesn't do**: Business logic, direct API calls, state aggregation

#### Frontend Services
- **Does**: API communication, data transformation, mock support
- **Doesn't do**: UI concerns, component state management

#### Backend Controllers (<50 lines each)
- **Does**: HTTP request/response handling, input validation
- **Doesn't do**: Business logic, direct database access, git operations

#### Backend Services
- **Does**: Business logic, orchestration, event emission
- **Doesn't do**: HTTP concerns, direct database queries (uses models)

#### Database Models
- **Does**: Data persistence, schema management, queries
- **Doesn't do**: Business logic, cross-table aggregation

## Architectural Achievements (v2.0.0)

### 1. Complete Service Layer ✅
**Impact**: Clear separation of concerns throughout the stack

```javascript
// Before: Controller doing everything (200+ lines)
class TaskController {
  async createTask(req, res) {
    // Mixed validation, git ops, database, websocket, etc.
  }
}

// After: Controller is thin HTTP handler (~10 lines)
class TaskController {
  async createTask(req, res) {
    const taskService = req.services.TaskService;
    const task = await taskService.createTask(req.params.projectId, req.body);
    res.json({ success: true, task });
  }
}
```

### 2. Deep Modules Everywhere ✅
**Impact**: Low cognitive load, easy to understand interfaces

| Module | Before | After |
|--------|--------|-------|
| api.ts | 44 methods | 8 services |
| git.service.js | 32+ methods | GitStatusService (4) + GitOperationService (6) |
| terminalStore | 30+ methods | TerminalService (8) |
| WebSocketEvents | 10 methods | EventEmitter pattern |

### 3. Event-Driven State Management ✅
**Impact**: Single source of truth with event propagation

- Database state (source of truth)
- Services emit events for state changes
- WebSocketService subscribes and broadcasts
- Frontend receives real-time updates
- No more state synchronization bugs

### 4. Dependency Injection Pattern ✅
**Impact**: Testable, maintainable code

```javascript
// Before: Global state via app.locals
app.locals.models = models;
app.locals.db = db;

// After: Clean closure-based dependency injection
const services = { 
  TaskService: new TaskService(models, eventEmitter),
  // ... other services
};
app.use((req, res, next) => {
  req.services = services;
  next();
});
```

### 5. Session Identity Unified ✅
**Impact**: No more confusion

- TerminalService handles all ID complexity internally
- Frontend uses SessionAdapter for normalization
- Components see only normalized IDs
- Three ID types hidden behind service interface

## Target Architecture

### Clean Layer Architecture
```
┌─────────────────────────────────────────────────────────────────────┐
│                          Frontend (React)                            │
│                    UI Components | State Management                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ HTTP/WS
┌─────────────────────────────────────────────────────────────────────┐
│                         API Gateway Layer                            │
│              Request Handling | Response Transformation              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Service Layer                                │
│         Business Logic | Orchestration | Domain Rules                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Repository Layer                               │
│              Data Access | Persistence | Caching                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                              │
│          Database | File System | External Services                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

#### Frontend
- **Only**: UI rendering, user interaction handling
- **Not**: Business logic, data aggregation, API knowledge

#### API Gateway
- **Only**: HTTP/WebSocket protocol handling, auth, routing
- **Not**: Business logic, direct database access

#### Service Layer (NEW)
- **Only**: Business logic, orchestration, domain rules
- **Not**: HTTP concerns, database queries

#### Repository Layer
- **Only**: Data access, query construction, caching
- **Not**: Business logic, HTTP concerns

#### Infrastructure
- **Only**: External system integration
- **Not**: Business logic, domain knowledge

### Real Deep Module Examples from v2.0.0

```javascript
// GitStatusService: 4 methods hiding complex git operations
class GitStatusService {
  getTaskGitStatus(projectId, taskId)      // Hides: git status parsing, worktree handling
  getTaskChangedFiles(projectId, taskId)   // Hides: diff calculation, file categorization
  getTaskAllChanges(projectId, taskId)     // Hides: content diff generation
  getTaskConflicts(projectId, taskId)      // Hides: merge-tree analysis
}

// TerminalService: 8 methods managing all terminal complexity
class TerminalService {
  createSession(taskId, config, context)   // Hides: Shelltender API, session setup
  executeCommand(sessionId, command)       // Hides: WebSocket communication
  getTaskSessions(taskId)                  // Hides: ID normalization, state aggregation
  updateSessionTab(sessionId, updates)     // Hides: database updates, event emission
  // ... 4 more focused methods
}

// SessionAdapter: Solves the 3 ID types problem
class SessionAdapter {
  static toFrontend(dbSession)             // Normalizes all ID types
  static toDatabase(frontendSession)       // Handles reverse mapping
  static normalizeShelltenderId(id)        // Extracts clean ID
}
```

## Migration Strategy

### Phase 1: Foundation (Weeks 1-2)
1. Create service layer structure
2. Extract migration system (BUG-012)
3. Implement dependency injection (BUG-014)

### Phase 2: Core Services (Weeks 3-4)
1. Create TaskService, ProjectService, GitService
2. Move business logic from controllers
3. Simplify api.ts (BUG-011)

### Phase 3: Deep Modules (Weeks 5-6)
1. Refactor each service to have <10 public methods
2. Hide implementation complexity
3. Consolidate session identity (BUG-017)

### Phase 4: Frontend Cleanup (Weeks 7-8)
1. Remove business logic from components
2. Simplify state management
3. Use services through clean API

## Success Metrics

### Code Quality
- No module with >10 public methods
- No file >400 lines
- Service layer handles 100% of business logic

### Architecture Health
- Clear layer boundaries
- No circular dependencies
- Single source of truth for state

### Developer Experience
- New features don't require understanding entire codebase
- Can explain any module's purpose in 1 minute
- Tests can be written in isolation

## Key Principles Going Forward

1. **Deep Modules**: Simple interfaces hiding complex implementations
2. **Single Responsibility**: Each layer does one thing well
3. **Information Hiding**: Implementation details never leak
4. **Dependency Injection**: No global state
5. **Clear Boundaries**: Layers communicate through defined interfaces

## Related Documents

- [Developer Guidance](./developer-guidance.md) - Coding principles
- [Module Design Examples](./module-design-examples.md) - Patterns to follow
- [Bug Prioritization](/plan-pocketdev/bugs/prioritization.md) - Refactoring roadmap

---

Remember: The goal is not just to make it work, but to make it simple to understand and maintain.