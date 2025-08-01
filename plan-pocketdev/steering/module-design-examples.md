# Module Design Examples for PocketDev

This document provides concrete examples of good and bad module design in the PocketDev codebase, helping developers understand how to create deep modules.

## 🎯 The Goal: Deep Modules

A deep module has a simple interface but provides significant functionality. The interface should be much simpler than the implementation.

## ✅ Good Example: A Deep Module Pattern

Here's how we could refactor the current git.service.js into a deep module:

```typescript
// DEEP MODULE: Simple interface, complex implementation
export class GitRepository {
  constructor(
    private projectPath: string,
    private credentials: GitCredentials
  ) {}

  // Only 5 public methods - simple to understand
  async synchronize(): Promise<SyncResult> {
    // 100+ lines of complex implementation:
    // - Fetch latest changes
    // - Detect conflicts
    // - Merge automatically if possible
    // - Return detailed status
  }

  async commitChanges(message: string): Promise<CommitResult> {
    // Complex implementation handling:
    // - Stage all changes
    // - Create commit with metadata
    // - Handle edge cases
    // - Update local refs
  }

  async analyzeStatus(): Promise<RepositoryStatus> {
    // Complex analysis including:
    // - Working tree status
    // - Comparison with remote
    // - Conflict detection
    // - Change statistics
  }

  async prepareForMerge(targetBranch: string): Promise<MergePreview> {
    // Non-destructive merge analysis
    // Shows what would happen
  }

  async publishChanges(): Promise<PublishResult> {
    // Push to remote with:
    // - Automatic conflict resolution
    // - PR creation if needed
    // - Status notifications
  }
}

// Usage is simple:
const repo = new GitRepository(projectPath, credentials);
const status = await repo.analyzeStatus();
if (status.hasChanges) {
  await repo.commitChanges("Update feature");
  await repo.publishChanges();
}
```

## ❌ Bad Example: Current Shallow Module

This is what we currently have - too many methods exposing implementation details:

```javascript
// SHALLOW MODULE: Complex interface, simple implementation
export class GitService {
  // 32+ public methods!
  async init(projectPath) { }
  async clone(url, path) { }
  async fetch(projectPath) { }
  async pull(projectPath) { }
  async push(projectPath) { }
  async add(projectPath, files) { }
  async commit(projectPath, message) { }
  async checkout(projectPath, branch) { }
  async createBranch(projectPath, name) { }
  async deleteBranch(projectPath, name) { }
  async merge(projectPath, branch) { }
  async rebase(projectPath, branch) { }
  async reset(projectPath, mode) { }
  async stash(projectPath) { }
  async stashPop(projectPath) { }
  async status(projectPath) { }
  async log(projectPath, options) { }
  async diff(projectPath, options) { }
  async getRemotes(projectPath) { }
  async addRemote(projectPath, name, url) { }
  async removeRemote(projectPath, name) { }
  async getTags(projectPath) { }
  async createTag(projectPath, name) { }
  async deleteTag(projectPath, name) { }
  async getConfig(projectPath, key) { }
  async setConfig(projectPath, key, value) { }
  // ... and more!

  // Each method is just a thin wrapper:
  async fetch(projectPath) {
    return this.exec(`git fetch`, projectPath);
  }
}
```

## 🔄 Transformation Examples

### Example 1: WebSocket Events (Current Problem)

```javascript
// ❌ CURRENT: 10 methods doing the same thing
class WebSocketEventService {
  sendTaskCreated(taskId, task) {
    this.broadcast(`task:${taskId}`, { type: 'created', task });
  }
  
  sendTaskUpdated(taskId, updates) {
    this.broadcast(`task:${taskId}`, { type: 'updated', updates });
  }
  
  sendTaskDeleted(taskId) {
    this.broadcast(`task:${taskId}`, { type: 'deleted' });
  }
  
  sendAIStateUpdate(taskId, state) {
    this.broadcast(`task:${taskId}`, { type: 'ai-state', state });
  }
  
  // ... 6 more similar methods
}
```

```javascript
// ✅ REFACTORED: 1 method with clear purpose
class EventBroadcaster {
  // Single method hides all complexity
  emit(channel: string, event: string, data?: any): void {
    const message = {
      type: event,
      channel,
      data,
      timestamp: Date.now(),
      version: '1.0'
    };
    
    // Complex implementation hidden:
    // - Connection management
    // - Retry logic
    // - Message queuing
    // - Error handling
    this.broadcastWithRetry(message);
  }
}

// Usage remains simple:
broadcaster.emit('task:123', 'updated', { status: 'complete' });
```

### Example 2: Terminal Store (Current Problem)

```typescript
// ❌ CURRENT: Exposes internal structure
interface TerminalStore {
  // Users must understand Map structure!
  terminals: Map<string, Map<string, Terminal>>;
  activeTerminals: Map<string, string>;
  focusedTerminals: Map<string, string>;
  
  // 30+ methods for basic operations
  addTerminal(taskId: string, terminal: Terminal): void;
  removeTerminal(taskId: string, terminalId: string): void;
  getTerminal(taskId: string, terminalId: string): Terminal | undefined;
  updateTerminal(taskId: string, terminalId: string, updates: Partial<Terminal>): void;
  setActiveTerminal(taskId: string, terminalId: string): void;
  getActiveTerminal(taskId: string): string | undefined;
  setFocusedTerminal(taskId: string, terminalId: string): void;
  getFocusedTerminal(taskId: string): string | undefined;
  // ... 22 more methods
}
```

```typescript
// ✅ REFACTORED: Simple interface hiding complexity
interface TerminalManager {
  // Only what users need to know
  getTaskTerminals(taskId: string): Terminal[];
  getActiveTerminal(taskId: string): Terminal | null;
  
  // High-level operations
  createTerminal(taskId: string, config: TerminalConfig): Terminal;
  closeTerminal(taskId: string, terminalId: string): void;
  focusTerminal(taskId: string, terminalId: string): void;
  
  // State changes handled internally
  updateTerminalState(taskId: string, terminalId: string, state: TerminalState): void;
}

// Implementation can use any data structure - users don't care!
class TerminalManagerImpl implements TerminalManager {
  // Private implementation - could be Map, Array, database, etc.
  private storage = new TerminalStorage();
  
  getTaskTerminals(taskId: string): Terminal[] {
    return this.storage.getByTask(taskId);
  }
  
  // Complex implementation hidden inside
}
```

### Example 3: Task Controller (Mixing Concerns)

```javascript
// ❌ CURRENT: Controller doing too much
class TaskController {
  async createTask(req, res) {
    // 200+ lines mixing:
    // - Parameter validation
    // - Git worktree creation
    // - Database operations
    // - Session launching
    // - WebSocket notifications
    // - Error handling for each step
    
    const projectPath = path.join(this.projectsDir, req.params.projectId);
    const worktreePath = path.join(projectPath, 'worktrees', taskId);
    
    // Direct git operations
    await this.gitService.createWorktree(projectPath, worktreePath, branch);
    
    // Direct database access
    const task = await this.models.tasks.create({ ... });
    
    // Direct WebSocket calls
    this.wsService.broadcast('task-created', task);
    
    // ... lots more
  }
}
```

```javascript
// ✅ REFACTORED: Thin controller, deep service
class TaskController {
  async createTask(req, res) {
    try {
      // Controller only handles HTTP
      const task = await this.taskService.createTask(
        req.params.projectId,
        req.body
      );
      res.json({ success: true, task });
    } catch (error) {
      res.status(error.statusCode || 500).json({ 
        error: error.message 
      });
    }
  }
}

class TaskService {
  // Deep module - simple interface, complex implementation
  async createTask(projectId: string, data: CreateTaskDTO): Promise<Task> {
    // All complexity hidden here
    const project = await this.validateProject(projectId);
    const task = await this.initializeTask(project, data);
    await this.setupWorkEnvironment(task);
    await this.notifyTaskCreated(task);
    return task;
  }
  
  // Private methods hide complexity
  private async setupWorkEnvironment(task: Task) {
    // 100+ lines of worktree setup
    // Error handling
    // Rollback logic
    // All hidden from users
  }
}
```

## 📊 Measuring Module Depth

### Shallow Module Indicators
- Interface has 10+ public methods
- Most methods are simple wrappers
- Users need to understand implementation
- Lots of configuration options
- Multiple responsibilities

### Deep Module Indicators
- Interface has 5-7 public methods
- Methods provide significant functionality
- Implementation much more complex than interface
- Minimal configuration needed
- Single, clear responsibility

## 🎨 Design Principles in Action

### 1. Information Hiding
```typescript
// ❌ BAD: Exposes how we store data
class ProjectStore {
  projects: Map<string, Project>;
  getProject(id: string): Project | undefined {
    return this.projects.get(id);
  }
}

// ✅ GOOD: Hides storage details
class ProjectRepository {
  findById(id: string): Promise<Project | null>;
  findByName(name: string): Promise<Project[]>;
  save(project: Project): Promise<void>;
}
```

### 2. Error Prevention Through Design
```typescript
// ❌ BAD: Easy to misuse
class FileUploader {
  upload(file: File, options?: {
    maxSize?: number;
    allowedTypes?: string[];
    destination?: string;
  }): Promise<string>;
}

// ✅ GOOD: Hard to misuse
class FileUploader {
  // Builder pattern prevents errors
  forImages(): ImageUploader;
  forDocuments(): DocumentUploader;
  
  // Each uploader has specific, safe defaults
}

class ImageUploader {
  withMaxSize(mb: number): this;
  upload(file: File): Promise<ImageUploadResult>;
}
```

### 3. Cognitive Load Reduction
```typescript
// ❌ BAD: Too many decisions for users
class TerminalLauncher {
  launch(options: {
    taskId: string;
    terminalId?: string;
    sessionId?: string;
    shellCommand?: string;
    workDir?: string;
    env?: Record<string, string>;
    aiAgent?: 'claude' | 'codex' | 'gemini';
    contextFiles?: string[];
    // ... 10 more options
  }): Promise<Terminal>;
}

// ✅ GOOD: Sensible defaults, progressive disclosure
class TerminalLauncher {
  // Simple common case
  launchForTask(taskId: string): Promise<Terminal>;
  
  // Advanced use through builder
  configure(): TerminalBuilder;
}

class TerminalBuilder {
  forTask(taskId: string): this;
  withAgent(agent: AIAgent): this;
  withContext(files: string[]): this;
  launch(): Promise<Terminal>;
}
```

## 🚀 Action Items for Developers

1. **When adding features**: Design the interface first, implement second
2. **When refactoring**: Start by simplifying the interface
3. **When reviewing**: Count public methods - aim for <10
4. **When confused**: Step back and hide more complexity

Remember: A module should be deep (lots of functionality) not wide (lots of methods).