# BUG-021: Database Models Have Cross-Table Query Contamination

<!-- Document Metadata
Created: 2025-09-12
Modified: 2025-09-12
Status: active
-->


## Summary
Database models directly query other models' tables, creating tight coupling and violating abstraction boundaries. The Models class adds no value while the individual models leak into each other's domains.

## Current State
- **Files**: `/backend/db/models/*.js`
- **Problem**: Models contain SQL queries for other models' tables
- **Impact**: Schema changes require searching all models for dependencies

## Evidence
```javascript
// ProjectModel directly queries tasks table:
async findById(id) {
  const project = await this.db.get(`
    SELECT p.*, COUNT(t.id) as task_count
    FROM projects p
    LEFT JOIN tasks t ON p.id = t.project_id  // Querying tasks table!
    WHERE p.id = ?
  `, [id]);
}

// TaskModel queries terminal_sessions extensively:
const sessions = await this.db.all(`
  SELECT task_id, id, ai_state, ai_state_updated_at
  FROM terminal_sessions  // Different model's table!
  WHERE task_id IN (${taskIds.map(() => '?').join(',')})
`, taskIds);

// Models class mixes abstraction levels:
async getOrphanedWorktrees() {
  return this.db.all(`  // Raw SQL in coordinator class
    SELECT wr.*, /* complex join query */
  `);
}
```

## Problems Identified
1. **Cross-model contamination**: Models query each other's tables
2. **Tight coupling**: Changes to one schema affect multiple models
3. **Shallow Models class**: Just a wrapper adding complexity
4. **Mixed abstraction levels**: SQL queries at wrong layer
5. **Duplicate JSON parsing**: Same logic repeated in every model

## Proposed Solution
Create proper abstraction boundaries:

```javascript
// Each model only queries its own table
class TaskModel {
  async findById(id) {
    // Only query tasks table
    return this.db.get('SELECT * FROM tasks WHERE id = ?', [id]);
  }
}

// Service layer handles cross-model operations
class TaskService {
  constructor(models) {
    this.models = models;
  }
  
  async getTaskWithDetails(id) {
    const task = await this.models.tasks.findById(id);
    const sessions = await this.models.sessions.findByTaskId(id);
    return { ...task, sessions };
  }
}

// Base model for common functionality
class BaseModel {
  parseJsonFields(record, fields) {
    // Centralized JSON parsing with proper error handling
  }
}
```

## Implementation Steps
1. Create BaseModel class for common functionality
2. Remove cross-table queries from models
3. Create service layer for aggregation
4. Move SQL from Models class to appropriate models
5. Implement proper error handling for JSON parsing
6. Add integration tests for cross-model operations

## Benefits
- **Loose coupling**: Models independent of each other
- **Clear boundaries**: Each model owns its table
- **Easier refactoring**: Schema changes isolated
- **Better testing**: Can test models in isolation
- **Consistent patterns**: Base class reduces duplication

## Priority: Medium
While not blocking features, this tight coupling makes the codebase fragile and hard to maintain. Schema changes are risky.

## Estimated Effort: 3-4 days

## Related
- Part of missing service layer (BUG-013)
- Similar to controller doing too much (BUG-010)
- Affects database maintainability

## Filed: 2025-08-01