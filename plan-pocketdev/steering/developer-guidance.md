# Developer Guidance for PocketDev

<!-- Document Metadata
Created: 2025-08-01
Modified: 2025-09-12
Status: active
-->


This document provides architectural guidance for AI agents and human developers working on PocketDev. It emphasizes creating high-quality, maintainable code following John Ousterhout's design principles.

## 🎯 Core Principle: Deep Modules

The most important concept in this codebase is creating **deep modules** - components with simple interfaces that hide significant complexity.

### The Deep Module Test
Ask yourself: "Can I explain this module's interface in 30 seconds, but the implementation would take 30 minutes?"
- **Good**: Yes, the interface is simple but does complex work
- **Bad**: The interface takes as long to explain as the implementation

## 📐 Architecture Guidelines

### 1. Interface Complexity Limits
- **Maximum 10 public methods** per module/class/component
- **Prefer 5-7 methods** for optimal cognitive load
- **If you need more**: Split into multiple modules

### 2. Information Hiding
```javascript
// ❌ BAD - Exposes implementation
class TerminalStore {
  terminals: Map<string, Map<string, Terminal>>;
  getTerminal(taskId, terminalId) { 
    return this.terminals.get(taskId)?.get(terminalId);
  }
}

// ✅ GOOD - Hides implementation
class TerminalStore {
  getTerminal(taskId, terminalId): Terminal | null;
  getTaskTerminals(taskId): Terminal[];
}
```

### 3. Single Responsibility
If you need "and" to describe what a module does, it's doing too much:
- ❌ "Handles terminal state AND session launching AND keyboard shortcuts"
- ✅ "Manages terminal state"

### 4. Abstraction Levels
Keep consistent abstraction levels within a module:
```javascript
// ❌ BAD - Mixed levels
class ProjectController {
  async createProject(req, res) {
    const projectId = crypto.randomBytes(8).toString('hex'); // Low level
    await this.validateGitHubAccess(req.body.repoUrl);      // High level
    const gitResult = exec(`git clone ${url}`);             // Low level
  }
}

// ✅ GOOD - Consistent level
class ProjectController {
  async createProject(req, res) {
    const project = await this.projectService.create(req.body);
    res.json(project);
  }
}
```

## 🚫 Anti-Patterns to Avoid

### 1. Backward Compatibility Layers
**This is a hobby project** - clean breaks are preferred:
- ❌ Creating adapters or wrappers for old code
- ❌ Keeping unused parameters "just in case"
- ❌ Stub methods that do nothing
- ✅ Delete old code immediately when refactoring
- ✅ Remove unused functionality completely

### 2. Shallow Modules
**Examples Fixed in v2.0.0**:
- `api.ts`: Was 44 methods → Now 8 service delegations ✅
- `websocket-events.js`: Was 10 methods → Now EventEmitter pattern ✅
- `git.service.js`: Was 32+ methods → Now split into GitStatusService (4) + GitOperationService (6) ✅

**Fix Applied**: Combined related operations into higher-level abstractions.

### 3. Pass-Through Methods
```javascript
// ❌ BAD
class TaskController {
  getGitService() { return this.gitService; }
  
  async updateTask(req, res) {
    const git = this.getGitService(); // Just passing through!
  }
}

// ✅ GOOD
class TaskController {
  constructor(private gitService: GitService) {}
  
  async updateTask(req, res) {
    // Use gitService directly
  }
}
```

### 4. Leaky Abstractions
Don't expose implementation details:
- ❌ Exposing Map/Set data structures
- ❌ Requiring users to understand internal state
- ❌ Error messages revealing implementation

### 4. God Objects
Components/classes doing too many things:
- ❌ OLD: `TerminalPanel` managing terminals, splits, sessions, keyboard, dropdowns
- ✅ v2.0.0: Split into services - `TerminalService`, `SplitViewContainer`, dedicated components

## 🏗️ Design Patterns to Follow

### 1. Service Layer Pattern
```typescript
// Controller (thin, HTTP only)
class TaskController {
  async createTask(req, res) {
    const task = await this.taskService.create(req.params.projectId, req.body);
    res.json({ success: true, task });
  }
}

// Service (business logic)
class TaskService {
  async create(projectId: string, data: CreateTaskDTO) {
    // All complexity hidden here
    const task = await this.initializeTask(projectId, data);
    await this.setupWorkEnvironment(task);
    await this.notifyCreation(task);
    return task;
  }
}
```

### 2. Repository Pattern
```typescript
// Hide database details
class TaskRepository {
  async findById(id: string): Promise<Task> {
    // SQL complexity hidden
  }
  
  async findByProject(projectId: string): Promise<Task[]> {
    // Complex joins hidden
  }
}
```

### 3. Factory Pattern
```typescript
// Hide creation complexity
class AIAgentFactory {
  createAgent(type: 'claude' | 'gemini' | 'codex'): AIAgent {
    // Complex initialization hidden
  }
}
```

## 📋 Code Review Checklist

Before submitting code, check:

### Interface Design
- [ ] Fewer than 10 public methods?
- [ ] Can interface be explained in <1 minute?
- [ ] Implementation details hidden?
- [ ] Single responsibility clear?

### Error Handling
- [ ] Errors defined out of existence where possible?
- [ ] Clear error types (not generic Error)?
- [ ] Graceful degradation?

### Dependencies
- [ ] No circular dependencies?
- [ ] Dependencies injected, not accessed globally?
- [ ] Minimal coupling between modules?

### Testing
- [ ] Can module be tested in isolation?
- [ ] Tests focus on interface, not implementation?
- [ ] Edge cases handled?

## 🔧 Practical Examples

### Example 1: Refactoring a Shallow Module
```typescript
// ❌ BEFORE: 10 methods for similar operations
class WebSocketEvents {
  sendTaskCreated(task) { this.broadcast('task-created', task); }
  sendTaskUpdated(task) { this.broadcast('task-updated', task); }
  sendTaskDeleted(id) { this.broadcast('task-deleted', { id }); }
  // ... 7 more similar methods
}

// ✅ AFTER: 1 method with clear interface
class EventBroadcaster {
  emit(entity: string, action: string, data: any) {
    const event = { 
      type: `${entity}-${action}`, 
      data,
      timestamp: new Date() 
    };
    this.broadcast(event);
  }
}
```

### Example 2: Creating a Deep Module
```typescript
// Deep module: Simple interface, complex implementation
class GitOperations {
  // Only 5 public methods hiding all git complexity
  async getStatus(projectId: string): Promise<GitStatus>;
  async commit(projectId: string, message: string): Promise<void>;
  async sync(projectId: string): Promise<SyncResult>;
  async detectConflicts(projectId: string): Promise<Conflict[]>;
  async resolveConflicts(projectId: string, resolution: Resolution): Promise<void>;
  
  // 500+ lines of private implementation hidden
}
```

## 🎓 Learning Resources

### Must Read
- "A Philosophy of Software Design" by John Ousterhout
- Current bug reports in `/plan-pocketdev/bugs/` showing refactoring examples

### Key Concepts to Master
1. **Interface vs Implementation Complexity**
2. **Information Hiding**
3. **Cognitive Load Reduction**
4. **Strategic vs Tactical Programming**

## 🚀 Refactoring Achievements (v2.0.0)

See `/plan-pocketdev/bugs/prioritization.md` for details. Completed:

1. **Service Layer** (BUG-013): ✅ Created 10 backend + 8 frontend services
2. **API Simplification** (BUG-011): ✅ 44 methods → 8 service delegations
3. **Deep Modules** (Multiple bugs): ✅ All services have <10 public methods
4. **Dependency Injection** (BUG-014): ✅ Closure-based DI replaces app.locals

### Remaining Priorities

1. **Functional Bugs**: BUG-001, BUG-002, BUG-023, BUG-024
2. **Frontend State Management**: Terminal session state duplication
3. **Performance**: Connection pooling, render throttling
4. **UX Improvements**: Visual hierarchy, complexity management

## 💡 Final Thoughts

Remember: **The goal is not just to make it work, but to make it simple.**

Every line of code you write either increases or decreases the system's complexity. Choose wisely. A deep module that takes longer to write but has a simple interface will save countless hours of confusion later.

When in doubt, ask:
1. Can this interface be simpler?
2. Am I hiding complexity or exposing it?
3. Will someone understand this in 6 months?

The best code is not clever - it's clear.