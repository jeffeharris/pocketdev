# Entity Relationship Model & Refactoring Strategy

## Entity Relationship Diagram

```
┌──────────────┐
│   PROJECTS   │
├──────────────┤
│ id (PK)      │
│ name         │
│ repo_url     │
│ base_branch  │
│ local_path   │
│ is_archived  │
│ metadata     │
└──────────────┘
        │
        │ 1:N
        ↓
┌──────────────┐       1:N      ┌────────────────────┐
│    TASKS     │ ─────────────→ │ TERMINAL_SESSIONS  │
├──────────────┤                 ├────────────────────┤
│ id (PK)      │                 │ id (PK)            │
│ project_id   │                 │ task_id (FK)       │
│ name         │                 │ session_id         │
│ branch       │                 │ shelltender_id     │
│ worktree_path│                 │ ai_state           │
│ status       │                 │ is_active          │
│ is_archived  │                 │ message_count      │
│ metadata     │                 │ token_usage        │
└──────────────┘                 └────────────────────┘
        │
        │ 1:1
        ↓
┌──────────────────┐
│ WORKTREE_REGISTRY│
├──────────────────┤
│ path (PK)        │
│ task_id (FK)     │
│ project_id (FK)  │
│ is_orphaned      │
└──────────────────┘

Standalone Tables:
┌──────────────────┐    ┌──────────┐
│  GIT_CREDENTIALS │    │ SETTINGS │
├──────────────────┤    ├──────────┤
│ id (PK)          │    │ key (PK) │
│ name             │    │ value    │
│ username         │    └──────────┘
│ token_encrypted  │
└──────────────────┘
```

## Current Anti-Patterns

### 1. Cross-Table Queries in Models
```javascript
// ❌ BAD: ProjectModel queries tasks table
SELECT p.*, COUNT(t.id) as task_count
FROM projects p
LEFT JOIN tasks t ON p.id = t.project_id

// ❌ BAD: TaskModel queries projects AND terminal_sessions
SELECT t.*, p.name as project_name, ts.ai_state
FROM tasks t
JOIN projects p ON t.project_id = p.id
LEFT JOIN terminal_sessions ts ON t.id = ts.task_id
```

### 2. Models Class Doing Too Much
- Contains raw SQL for worktree_registry
- Manages settings (different concern)
- Performs complex aggregations

## Proposed Architecture

### Layer 1: Pure Models (Single Table Responsibility)
Each model ONLY queries its own table:

```javascript
// ✅ GOOD: Each model owns ONE table
class ProjectModel extends BaseModel {
  tableName = 'projects';
  
  async findById(id) {
    return this.db.get('SELECT * FROM projects WHERE id = ?', [id]);
  }
  
  async findAll() {
    return this.db.all('SELECT * FROM projects WHERE is_archived = 0');
  }
}

class TaskModel extends BaseModel {
  tableName = 'tasks';
  
  async findById(id) {
    return this.db.get('SELECT * FROM tasks WHERE id = ?', [id]);
  }
  
  async findByProjectId(projectId) {
    return this.db.all('SELECT * FROM tasks WHERE project_id = ?', [projectId]);
  }
}
```

### Layer 2: Services (Cross-Model Orchestration)
Services handle relationships and aggregations:

```javascript
// ✅ GOOD: Service layer handles relationships
class ProjectService {
  async getProjectWithTaskCount(id) {
    const project = await this.models.projects.findById(id);
    const tasks = await this.models.tasks.findByProjectId(id);
    return {
      ...project,
      task_count: tasks.length
    };
  }
}

class TaskService {
  async getTaskWithDetails(id) {
    const task = await this.models.tasks.findById(id);
    const project = await this.models.projects.findById(task.project_id);
    const sessions = await this.models.sessions.findByTaskId(id);
    
    return {
      ...task,
      project_name: project.name,
      sessions
    };
  }
}
```

## Implementation Strategy

### Phase 1: Create Foundation (Day 1)
1. **Create BaseModel class**
   - Common CRUD operations
   - JSON field parsing
   - Error handling
   - Timestamp management

2. **Create Model interfaces**
   - Define what each model should expose
   - Document single-table responsibility

### Phase 2: Refactor Models (Day 2)
1. **ProjectModel**
   - Remove task counting queries
   - Only query projects table
   - Return pure project data

2. **TaskModel**  
   - Remove project/session joins
   - Only query tasks table
   - Add findByProjectId method

3. **SessionModel**
   - Remove task/project joins
   - Only query terminal_sessions table
   - Add findByTaskId method

4. **Create new models**
   - WorktreeRegistryModel (move from Models class)
   - SettingsModel (move from Models class)

### Phase 3: Update Services (Day 3)
1. **ProjectService**
   - Add getProjectWithTaskCount()
   - Add getProjectWithStats()
   - Handle project-task relationships

2. **TaskService**
   - Add getTaskWithDetails()
   - Add getTaskWithSessions()
   - Handle task-project-session relationships

3. **WorktreeService**
   - Move worktree logic from Models class
   - Add getOrphanedWorktrees()
   - Handle worktree-task-project relationships

### Phase 4: Update Controllers (Day 4)
1. Update controllers to use services instead of direct model queries
2. Remove any remaining cross-table logic from controllers
3. Ensure proper error handling at service boundaries

## Benefits of This Approach

1. **Testability**: Can test each model with just its table
2. **Maintainability**: Schema changes only affect one model
3. **Clarity**: Clear separation of concerns
4. **Performance**: Can optimize queries at appropriate layer
5. **Flexibility**: Easy to add caching at service layer

## Migration Path

### Step 1: Non-Breaking Addition
- Add new BaseModel and pure models alongside existing
- Services use new models internally
- Controllers continue using existing interface

### Step 2: Gradual Migration
- Update one controller at a time
- Run tests after each change
- Keep old models until all references removed

### Step 3: Cleanup
- Remove old cross-contaminated models
- Remove Models class or reduce to factory
- Update documentation

## Success Criteria

- [ ] Each model queries only its own table
- [ ] No raw SQL in Models class (except model instantiation)
- [ ] Services handle all cross-table operations
- [ ] Controllers use services, not models directly
- [ ] All tests pass with new architecture
- [ ] No performance degradation

## Risks & Mitigations

1. **Risk**: Breaking existing functionality
   - **Mitigation**: Parallel implementation, gradual migration

2. **Risk**: Performance degradation from multiple queries
   - **Mitigation**: Service layer can optimize with batch queries

3. **Risk**: Complex refactoring affecting many files
   - **Mitigation**: Phase approach, test after each phase

## Next Steps

1. Review and approve this design
2. Create BaseModel class
3. Start with ProjectModel as proof of concept
4. Gradually refactor remaining models
5. Update services to handle relationships
6. Migrate controllers one at a time