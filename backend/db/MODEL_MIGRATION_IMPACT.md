# Model Migration Impact Analysis

<!-- Document Metadata
Created: 2025-09-12
Modified: 2025-09-12
Status: active
-->


## Current Model Usage

### Statistics
- **ProjectModel**: 77 references across codebase
- **TaskModel**: 83 references across codebase  
- **SessionModel**: 22 references across codebase
- **Total**: 182 references to refactor

### Services Using Models (10 services)
1. container.service.js
2. git-operation.service.js
3. git-status.service.js
4. monitoring.service.js
5. project.service.js
6. pull-request.service.js
7. session-cleanup.service.js
8. task.service.js
9. terminal.service.js
10. upload.service.js

### Controllers Using Models
- project.controller.js
- task.controller.js
- task-git.controller.js
- settings.controller.js
- monitoring.controller.js

## Critical Cross-Table Queries to Refactor

### ProjectModel Cross-Table Queries
```javascript
// Current: Projects querying tasks
findById() {
  SELECT p.*, COUNT(t.id) as task_count
  FROM projects p
  LEFT JOIN tasks t ON p.id = t.project_id
}
```

**Used by:**
- ProjectService.getProjectDetails()
- project.controller.js GET /api/projects/:id
- Frontend dashboard for project cards

### TaskModel Cross-Table Queries
```javascript
// Current: Tasks querying projects AND sessions
findWithDetails() {
  SELECT t.*, p.name as project_name, ts.ai_state
  FROM tasks t
  JOIN projects p ON t.project_id = p.id
  LEFT JOIN terminal_sessions ts ON t.id = ts.task_id
}
```

**Used by:**
- TaskService.getTaskWithDetails()
- task.controller.js GET /api/projects/:projectId/tasks/:taskId
- Git status monitoring
- Terminal state aggregation

### SessionModel Cross-Table Queries
```javascript
// Current: Sessions querying tasks AND projects
findByTaskWithProject() {
  SELECT cs.*, t.name as task_name, p.name as project_name
  FROM terminal_sessions cs
  JOIN tasks t ON cs.task_id = t.id
  JOIN projects p ON t.project_id = p.id
}
```

**Used by:**
- TerminalService.getSessionDetails()
- Monitoring dashboard
- Session cleanup service

## Migration Strategy

### Phase 1: Parallel Implementation (Non-Breaking)
1. ✅ Create new pure models alongside existing ones
   - project-pure.js
   - task-pure.js  
   - session-pure.js
2. Update Models class to use both old and new
3. Add compatibility layer in services

### Phase 2: Service Layer Updates
1. Update ProjectService to handle aggregation
   ```javascript
   // New approach
   async getProjectWithTaskCount(id) {
     const project = await this.models.projects.findById(id);
     const taskCount = await this.models.tasks.countByProjectId(id);
     return { ...project, task_count: taskCount };
   }
   ```

2. Update TaskService for cross-table data
   ```javascript
   async getTaskWithDetails(id) {
     const task = await this.models.tasks.findById(id);
     const project = await this.models.projects.findById(task.project_id);
     const sessions = await this.models.sessions.findByTaskId(id);
     return { ...task, project_name: project.name, sessions };
   }
   ```

### Phase 3: Controller Migration
1. Start with least-used controllers
2. Update one endpoint at a time
3. Test thoroughly after each change

### Phase 4: Cleanup
1. Remove old model files
2. Remove compatibility layers
3. Update documentation

## Risk Areas

### High Risk (Most Complex)
1. **TaskService.getTaskWithDetails()** - Used in 15+ places
2. **ProjectService.getProjectDetails()** - Dashboard critical
3. **Git status monitoring** - Relies on cross-table queries

### Medium Risk
1. Session cleanup service
2. Monitoring dashboard
3. Upload service

### Low Risk  
1. Settings controller
2. Archive operations
3. Search functionality

## Testing Strategy

### Unit Tests Required
- [ ] BaseModel CRUD operations
- [ ] Each pure model's methods
- [ ] Service aggregation methods
- [ ] Controller endpoints

### Integration Tests Required
- [ ] Project creation with tasks
- [ ] Task updates affecting project stats
- [ ] Session creation and cleanup
- [ ] Git operations

### Performance Tests
- [ ] Compare query performance (single vs multiple queries)
- [ ] Monitor N+1 query problems
- [ ] Check response times for dashboards

## Rollback Plan

If issues occur:
1. Keep old models in place during migration
2. Use feature flags to switch between old/new
3. Can revert service by service
4. Database schema unchanged - only query patterns

## Success Metrics

- [ ] All 182 references migrated
- [ ] No performance degradation
- [ ] All tests passing
- [ ] No increase in database queries for common operations
- [ ] Code complexity reduced (fewer lines in models)

## Timeline Estimate

- **Phase 1**: 1 day (models creation) ✅ In Progress
- **Phase 2**: 2-3 days (service updates)
- **Phase 3**: 2-3 days (controller migration)
- **Phase 4**: 1 day (cleanup and testing)
- **Total**: 6-8 days for complete migration

## Next Steps

1. Complete remaining pure models (SessionModel, WorktreeRegistryModel, SettingsModel)
2. Create compatibility layer in Models class
3. Start with ProjectService as proof of concept
4. Gradually migrate other services
5. Update controllers last (they're the user-facing layer)