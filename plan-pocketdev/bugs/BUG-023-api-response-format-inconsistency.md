# BUG-023: API Response Format Inconsistency

<!-- Document Metadata
Created: 2025-08-03
Modified: 2025-08-03
Status: ????
-->


## Summary
Backend API endpoints have inconsistent response formats, with some returning bare objects and others wrapping responses in `{ success: true/false, ... }` objects. This creates confusion and potential bugs when frontend code expects one format but receives another.

## Current Behavior
The task controller (and likely other controllers) use multiple response patterns:

**Pattern 1 - Direct object return:**
```javascript
res.json(task);  // Returns: { id: "123", name: "Task", ... }
res.status(500).json({ error: error.message });
```

**Pattern 2 - Success wrapper:**
```javascript
res.json({ success: true, task: task, session: session });
res.status(500).json({ success: false, error: error.message });
```

**Pattern 3 - Operation result with success flag:**
```javascript
res.json({ 
  success: true,
  message: "Successfully merged...",
  mergeTask: { ... }
});
```

## Examples Found
1. `createTask` - Was returning `{ success: true, task: ..., session: ... }` but frontend expected just task object
2. `deleteTask` - Returns `{ success: true, archived: boolean, message: string }`
3. `listTasks` - Returns array directly
4. `getTask` - Returns task object directly
5. Merge operations - Return `{ success: true, ... }` with operation details

## Expected Behavior
API responses should follow a consistent pattern. Either:

**Option A - Always return bare objects/arrays:**
- Success: `res.json(data)`
- Error: `res.status(4xx/5xx).json({ error: "message" })`

**Option B - Always wrap in result object:**
- Success: `res.json({ success: true, data: result })`
- Error: `res.status(4xx/5xx).json({ success: false, error: "message" })`

## Impact
- Frontend code must handle multiple response formats
- Difficult to create generic API error handling
- Type safety is compromised
- New developers must learn multiple patterns

## Root Cause
- No established API response standard
- Controllers evolved independently
- Some operations need additional metadata (like "needsPush" flag)

## Proposed Solution
1. Audit all API endpoints to document current response formats
2. Define standard response format in API documentation
3. Create response helper functions (e.g., `res.success(data)`, `res.error(message, code)`)
4. Gradually migrate endpoints to consistent format
5. Update frontend API client to handle both formats during transition

## Workaround
Currently, frontend code must check the response format and handle accordingly. Fixed `createTask` by changing response to match frontend expectation.

## Related Issues
- General API design inconsistency
- Lack of API documentation
- Frontend type safety concerns