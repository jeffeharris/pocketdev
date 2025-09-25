# PocketDev Domain Model & Architecture

<!-- Document Metadata
Created: 2025-09-14
Modified: 2025-09-14
Status: active
-->


## Architecture Decisions (Confirmed)
1. **Domain Complexity**: Lightweight domain objects with validation
2. **State Management**: Keep Zustand with domain/UI organization  
3. **Error Handling**: Simple error categories
4. **Priority**: Domain model first (foundational)

## Domain Model Structure

### Core Domain Objects
Simple TypeScript/JavaScript classes with:
- Basic validation in constructors
- Business rules as methods
- No framework dependencies
- Shared between frontend/backend where possible

```typescript
// Lightweight domain objects - NOT full DDD
class Project {
  constructor(
    readonly id: string,
    public name: string,
    public repoUrl: string,
    public baseBranch: string = 'main'
  ) {
    this.validate();
  }
  
  private validate() {
    if (!this.name?.trim()) throw new ValidationError('name', 'Project name required');
    if (!this.repoUrl?.trim()) throw new ValidationError('repoUrl', 'Repository URL required');
    if (!this.isValidGitUrl(this.repoUrl)) throw new ValidationError('repoUrl', 'Invalid git URL');
  }
  
  private isValidGitUrl(url: string): boolean {
    return url.startsWith('https://') || url.startsWith('git@');
  }
  
  canCreateTask(): boolean {
    // Business rule: Can always create tasks for now
    // Future: might check for max tasks, permissions, etc.
    return true;
  }
}

class Task {
  constructor(
    readonly id: string,
    readonly projectId: string,
    public name: string,
    public branch: string,
    public worktreePath: string,
    public state: 'active' | 'merged' | 'archived' = 'active',
    public hasUncommittedChanges: boolean = false,
    public hasConflicts: boolean = false
  ) {
    this.validate();
  }
  
  private validate() {
    if (!this.name?.trim()) throw new ValidationError('name', 'Task name required');
    if (!this.branch?.trim()) throw new ValidationError('branch', 'Branch name required');
    if (!this.worktreePath) throw new ValidationError('worktreePath', 'Worktree path required');
  }
  
  canMerge(): boolean {
    return this.state === 'active' && 
           !this.hasConflicts && 
           !this.hasUncommittedChanges;
  }
  
  markMerged() {
    if (!this.canMerge()) {
      throw new ValidationError('state', 'Cannot merge task in current state');
    }
    this.state = 'merged';
  }
  
  archive() {
    if (this.state !== 'merged') {
      throw new ValidationError('state', 'Can only archive merged tasks');
    }
    this.state = 'archived';
  }
}

class TerminalSession {
  constructor(
    readonly id: string,
    readonly taskId: string,
    public shelltenderId: string,
    public tabName: string,
    public aiState: 'not-started' | 'idle' | 'working' | 'waiting' = 'not-started'
  ) {
    this.validate();
  }
  
  private validate() {
    if (!this.tabName?.trim()) throw new ValidationError('tabName', 'Tab name required');
  }
  
  isActive(): boolean {
    return this.aiState !== 'not-started';
  }
  
  canAcceptInput(): boolean {
    return this.aiState === 'idle' || this.aiState === 'waiting';
  }
}
```

## Error Hierarchy (Simple Categories)

```typescript
// shared/domain/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: 'VALIDATION' | 'NOT_FOUND' | 'CONFLICT' | 'SYSTEM',
    public readonly field?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(field: string, message: string) {
    super(`${field}: ${message}`, 'VALIDATION', field);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(`${entity} with id ${id} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}
```

## Repository Pattern (Lightweight)

```typescript
// backend/repositories/project.repository.ts
export class ProjectRepository {
  constructor(private db: Database) {}
  
  async findById(id: string): Promise<Project | null> {
    const data = await this.db.projects.findById(id);
    if (!data) return null;
    
    // Convert database row to domain object
    return new Project(
      data.id,
      data.name,
      data.repo_url,
      data.base_branch
    );
  }
  
  async save(project: Project): Promise<void> {
    // Convert domain object to database format
    await this.db.projects.upsert({
      id: project.id,
      name: project.name,
      repo_url: project.repoUrl,
      base_branch: project.baseBranch,
      updated_at: new Date().toISOString()
    });
  }
  
  async findAll(): Promise<Project[]> {
    const rows = await this.db.projects.findAll();
    return rows.map(row => new Project(
      row.id,
      row.name,
      row.repo_url,
      row.base_branch
    ));
  }
}
```

## Frontend State Organization

```
frontend/src/stores/
├── domain/              # Business data stores
│   ├── projectStore.ts  # Projects from API
│   ├── taskStore.ts     # Tasks and their state
│   └── terminalStore.ts # Terminal sessions
└── ui/                  # UI-only state
    ├── modalStore.ts    # Modal open/close state
    ├── splitViewStore.ts # Split view layout
    └── selectionStore.ts # Selected items
```

### Domain Store Example
```typescript
// frontend/src/stores/domain/taskStore.ts
interface TaskStore {
  // State
  tasks: Map<string, Task>;
  loading: boolean;
  
  // Actions (simple, focused)
  loadTasks(projectId: string): Promise<void>;
  updateTask(taskId: string, updates: Partial<Task>): void;
  markTaskMerged(taskId: string): void;
  
  // Queries
  getTask(taskId: string): Task | undefined;
  getTasksByProject(projectId: string): Task[];
  getActiveTasks(): Task[];
}
```

### UI Store Example
```typescript
// frontend/src/stores/ui/modalStore.ts
interface ModalStore {
  // State
  openModals: Set<string>;
  
  // Actions
  openModal(modalId: string): void;
  closeModal(modalId: string): void;
  isOpen(modalId: string): boolean;
}
```

## Implementation Phases

### Phase 1: Domain Objects (Current)
1. Create `/shared/domain/` directory
2. Implement Project, Task, TerminalSession classes
3. Implement simple error hierarchy
4. Add validation tests

### Phase 2: Repository Pattern
1. Create `/backend/repositories/` directory
2. Implement ProjectRepository, TaskRepository
3. Update services to use repositories
4. Remove direct database access from services

### Phase 3: Frontend State Organization  
1. Reorganize stores into domain/ui directories
2. Simplify store interfaces (8 methods max)
3. Remove mock data from stores
4. Update components to use new structure

### Phase 4: Service Layer Alignment
1. Update services to use domain objects
2. Separate commands from queries
3. Ensure events use domain objects
4. Add domain validation before persistence

## Benefits of This Approach

1. **Clear mental model**: Domain objects match business concepts
2. **Validation in one place**: Constructor validation ensures valid state
3. **Business rules explicit**: Methods like `canMerge()` document rules
4. **Testable**: Pure domain objects are easy to test
5. **Gradual migration**: Can adopt incrementally without breaking changes
6. **Type safety**: TypeScript ensures consistency across layers

## Next Steps

1. Create domain objects for Project, Task, TerminalSession
2. Add unit tests for domain validation and business rules
3. Create first repository (ProjectRepository) as proof of concept
4. Migrate one service to use repository pattern
5. Gradually roll out to other services