# API Response Pattern Analysis

## Current Response Patterns Found

### Pattern 1: Direct Data Return (Most Common)
Used for simple GET operations and lists:
```javascript
// Success
res.json(task);                    // Single object
res.json(projects);                 // Array
res.json({ sessions: [] });        // Wrapped array
res.json({ task, project });       // Multiple values

// Error
res.status(404).json({ error: 'Not found' });
res.status(500).json({ error: error.message });
```

**Controllers using this pattern:**
- project.controller.js (most endpoints)
- terminal.controller.js (all endpoints)
- monitoring.controller.js
- settings.controller.js

### Pattern 2: Success Flag Pattern
Used for operations that need to indicate success/failure:
```javascript
// Success
res.json({ 
  success: true, 
  message: 'Operation completed',
  data: result 
});

// Error
res.status(400).json({ 
  success: false, 
  error: error.message 
});
```

**Controllers using this pattern:**
- task.controller.js (merge operations)
- task-git.controller.js (some operations)
- project.controller.js (clone, refresh operations)
- task-container.controller.js (container operations)

### Pattern 3: Mixed Pattern
Some endpoints return different formats based on the operation:
```javascript
// task.controller.js
createTask() -> returns task directly
mergeTask() -> returns { success: true, message, mergeTask }
deleteTask() -> returns { success: true, archived, message }
```

## Problems Identified

1. **Inconsistent Error Handling**
   - Some return `{ error: 'message' }`
   - Others return `{ success: false, error: 'message' }`
   - Status codes vary (400 vs 500 for similar errors)

2. **Inconsistent Success Responses**
   - GET endpoints: Direct data
   - POST/PUT: Sometimes direct, sometimes wrapped
   - DELETE: Usually wrapped with success flag

3. **No Standard for Complex Operations**
   - Merge operations include extra metadata
   - Clone operations include progress information
   - No consistent way to include warnings or additional info

## Recommendation

### Adopt RESTful Convention (Simpler, Industry Standard)

**For ALL endpoints:**
```javascript
// Success - return data directly
res.json(data);                    // 200 OK
res.status(201).json(created);     // 201 Created
res.status(204).send();            // 204 No Content (for DELETE)

// Error - consistent error object
res.status(400).json({ 
  error: 'Validation failed',
  details: { field: 'reason' }     // Optional
});

res.status(404).json({ 
  error: 'Resource not found' 
});

res.status(500).json({ 
  error: 'Internal server error',
  message: error.message            // In development only
});
```

**For operations needing metadata:**
```javascript
// Return the data with metadata as properties
res.json({
  task: mergedTask,
  message: 'Successfully merged',
  needsPush: true
});
```

### Implementation Strategy

1. **Create response helpers** in `/backend/utils/response.js`:
```javascript
export function sendSuccess(res, data, statusCode = 200) {
  res.status(statusCode).json(data);
}

export function sendError(res, message, statusCode = 500, details = null) {
  const error = { error: message };
  if (details) error.details = details;
  res.status(statusCode).json(error);
}

export function sendCreated(res, data) {
  res.status(201).json(data);
}

export function sendNoContent(res) {
  res.status(204).send();
}
```

2. **Gradually migrate controllers** starting with the most used ones:
   - project.controller.js
   - task.controller.js
   - terminal.controller.js

3. **Update frontend API client** to handle consistent format

## Migration Priority

1. **High Traffic Endpoints** (fix first):
   - GET /api/projects
   - GET /api/projects/:id/tasks
   - GET /api/projects/:projectId/tasks/:taskId
   - POST /api/projects/:projectId/tasks

2. **Complex Operations** (standardize metadata):
   - Merge operations
   - Clone operations
   - Container operations

3. **Error Responses** (make consistent):
   - All 404 responses
   - All validation errors
   - All server errors