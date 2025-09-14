# Domain Model Migration Guide

## Overview
This guide shows how to gradually adopt the lightweight domain model in PocketDev without breaking existing code.

## What We've Created

### 1. Domain Objects (`/shared/domain/`)
- `Project` - Git repository with validation
- `Task` - Feature branch/worktree with business rules  
- `TerminalSession` - AI developer session with state transitions
- Simple error hierarchy (ValidationError, NotFoundError, etc.)

### 2. Repository Pattern (`/backend/repositories/`)
- Converts between domain objects and database
- Encapsulates persistence logic
- Enforces business rules before saving

## Migration Strategy

### Phase 1: Use Domain Objects for Validation (No Breaking Changes)

Start using domain objects to validate data without changing existing code:

```javascript
// backend/services/project.service.js
import { Project } from '../../shared/domain/index.js';

async create(projectData, options = {}) {
  const { repoUrl, branch = 'main', projectName } = projectData;
  
  // NEW: Use domain object for validation
  const project = new Project(
    crypto.randomBytes(4).toString('hex'),
    projectName || repoUrl.split('/').pop().replace('.git', ''),
    repoUrl,
    branch
  );
  
  // Rest of existing code unchanged
  const projectPath = await this.gitOps.cloneProject(repoUrl, project.id, branch);
  
  // Save using existing model (not repository yet)
  const saved = await this.models.projects.create({
    id: project.id,
    name: project.name,
    repo_url: project.repoUrl,
    base_branch: project.baseBranch,
    local_path: projectPath,
    created_at: new Date().toISOString()
  });
  
  return saved;
}
```

### Phase 2: Introduce Repositories Alongside Services

Add repositories without removing existing code:

```javascript
// backend/services/project.service.js
import { ProjectRepository } from '../repositories/project.repository.js';

constructor(models, githubTokenService, githubService) {
  // Keep existing setup
  this.models = models;
  this.githubTokenService = githubTokenService;
  
  // NEW: Add repository
  this.projectRepo = new ProjectRepository(models);
}

// New method using repository
async getProjectDomain(projectId) {
  return await this.projectRepo.findById(projectId);
}

// Existing method still works
async get(projectId, includes = []) {
  // Existing code unchanged
}
```

### Phase 3: Gradually Replace Model Calls with Repository

Replace direct model usage one method at a time:

```javascript
// BEFORE
async findById(projectId) {
  const project = await this.models.projects.findById(projectId);
  if (!project) {
    throw new Error('Project not found');
  }
  return project;
}

// AFTER
async findById(projectId) {
  const project = await this.projectRepo.findById(projectId);
  // Returns domain object now, but controller doesn't need to know
  return project.toDatabaseFormat();
}
```

### Phase 4: Update Controllers to Use Domain Objects

Once services return domain objects, update controllers:

```javascript
// backend/controllers/project.controller.js

// BEFORE
async get(req, res, next) {
  const project = await projectService.get(projectId);
  res.json(project);
}

// AFTER  
async get(req, res, next) {
  const project = await projectService.get(projectId);
  // Convert domain object to API format if needed
  res.json({
    id: project.id,
    name: project.name,
    repository: project.repoUrl, // Map to frontend expected format
    baseBranch: project.baseBranch
  });
}
```

## Frontend Integration

### Using Domain Objects in Frontend Services

```javascript
// frontend/src/services/project.service.ts
import { Project } from '../../../shared/domain/project.js';

async getProject(id: string): Promise<Project> {
  const response = await this.get(`/projects/${id}`);
  
  // Convert API response to domain object
  return new Project(
    response.id,
    response.name,
    response.repository,
    response.baseBranch
  );
}
```

### Store Organization

Move from mixed stores to domain/UI separation:

```
BEFORE:
stores/
  terminalStore.ts (mixed UI and domain)
  projectStore.ts (mixed)
  
AFTER:
stores/
  domain/
    projectStore.ts (Project domain objects)
    taskStore.ts (Task domain objects)
  ui/
    modalStore.ts (which modals are open)
    splitViewStore.ts (layout state)
```

## Benefits You'll See Immediately

1. **Validation in one place**: No more scattered validation logic
2. **Business rules explicit**: `task.canMerge()` is self-documenting
3. **Type safety**: Domain objects provide consistent shape
4. **Easier testing**: Pure domain objects with no dependencies

## Common Patterns

### Pattern 1: Command with Domain Validation
```javascript
async createTask(projectId, taskData) {
  // Create domain object (validates automatically)
  const task = new Task(
    generateId(),
    projectId,
    taskData.name,
    taskData.branch,
    worktreePath
  );
  
  // Save if valid
  await this.taskRepo.save(task);
  
  // Emit event
  this.events.emit('task.created', task);
  
  return task;
}
```

### Pattern 2: Query with View Transformation
```javascript
async getTaskList(projectId) {
  // Get domain objects
  const tasks = await this.taskRepo.findByProject(projectId);
  
  // Transform to view model
  return tasks.map(task => ({
    id: task.id,
    name: task.name,
    status: task.canMerge() ? 'ready' : 'blocked',
    branch: task.branch
  }));
}
```

### Pattern 3: Business Rule Enforcement
```javascript
async mergeTask(taskId) {
  const task = await this.taskRepo.findById(taskId);
  
  // Business rule checked by domain object
  if (!task.canMerge()) {
    throw new ConflictError(`Task cannot be merged: ${task.state}`);
  }
  
  // Perform merge
  await this.gitService.merge(task.worktreePath);
  
  // Update state
  task.markMerged();
  await this.taskRepo.save(task);
}
```

## Gradual Adoption Checklist

- [ ] Add `/shared/domain/` objects
- [ ] Create repositories for one service
- [ ] Use domain objects for validation in that service
- [ ] Replace model calls with repository calls
- [ ] Update controller to handle domain objects
- [ ] Repeat for next service
- [ ] Organize frontend stores into domain/UI
- [ ] Remove old validation code
- [ ] Remove direct database access from services

## Remember

- You don't need to migrate everything at once
- Existing code continues to work during migration
- Each step provides value even if you don't complete all steps
- This is a hobby project - keep it fun and manageable!