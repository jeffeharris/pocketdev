# PocketDev Architecture Overview

This document provides a comprehensive view of PocketDev's current architecture, its problems, and the target architecture we're working towards.

## Current Architecture

### System Overview
```
┌─────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  Frontend       │────▶│  Backend API        │────▶│  SQLite DB       │
│  (React/Vite)   │ HTTP│  (Express)          │     │                  │
│  Port 5173      │     │  Port 3005          │     └──────────────────┘
└─────────────────┘     └─────────────────────┘              │
         │                        │                           │
         │                        └─── HTTP/WS ──────────────┼───┐
         │                                                    │   │
         └────────── WebSocket ──────────────────────────────┼───┼───┐
                                                             │   │   │
                                                    ┌────────▼───▼───▼────┐
                                                    │  Shelltender       │
                                                    │  (Terminal Service) │
                                                    │  Port 8080         │
                                                    └────────────────────┘
```

### Current Layer Responsibilities (The Problem)

#### Frontend (React)
- **Should do**: UI rendering, user interactions
- **Currently does**: Business logic, state aggregation, complex data transformations

#### Backend API (Express)
- **Should do**: HTTP handling, request/response transformation
- **Currently does**: Business logic, Git operations, database queries, WebSocket handling

#### Database Models
- **Should do**: Data persistence, schema management
- **Currently does**: Cross-table queries, business logic, state aggregation

## Architectural Problems

### 1. Missing Service Layer
**Impact**: Business logic scattered across controllers, models, and frontend

```javascript
// Current: Controller doing everything
class TaskController {
  async createTask(req, res) {
    // Validation
    // Git operations
    // Database operations
    // WebSocket notifications
    // Session management
    // Error handling
    // 200+ lines of mixed concerns
  }
}
```

### 2. Shallow Modules Everywhere
**Impact**: High cognitive load, difficult to understand and maintain

| Module | Current Methods | Should Be |
|--------|----------------|-----------|
| api.ts | 44 | ~8 |
| git.service.js | 32+ | 4-5 |
| terminalStore | 30+ | ~10 |
| WebSocketEvents | 10 | 1 |

### 3. Multiple State Representations
**Impact**: Race conditions, synchronization bugs, complexity

- Database state (source of truth)
- Backend in-memory state
- WebSocket message state
- Frontend store state
- Component local state

### 4. Global State Anti-Pattern
**Impact**: Hidden dependencies, untestable code

```javascript
// Current: Global state via app.locals
app.locals.models = models;
app.locals.db = db;
app.locals.github = github;
// ... 10+ more
```

### 5. Identity Crisis
**Impact**: Confusion throughout codebase

Three different IDs for the same session:
- `sessionId` (Shelltender)
- `dbSessionId` (Database)
- `shelltenderSessionId` (Also Shelltender)

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

### Deep Module Examples

```typescript
// Deep Module: Simple interface, complex implementation
class TaskService {
  // Only 5 public methods
  createTask(projectId: string, data: CreateTaskDTO): Promise<Task>
  updateTask(taskId: string, updates: UpdateTaskDTO): Promise<Task>
  deleteTask(taskId: string): Promise<void>
  getTask(taskId: string): Promise<Task>
  listTasks(projectId: string): Promise<Task[]>
  
  // Hundreds of lines of complex implementation hidden inside
}

// Deep Module: Git operations
class GitOperations {
  synchronize(projectId: string): Promise<SyncResult>
  commit(projectId: string, message: string): Promise<void>
  analyzeConflicts(projectId: string): Promise<Conflict[]>
  
  // All git complexity hidden
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