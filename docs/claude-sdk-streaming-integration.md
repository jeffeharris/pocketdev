# Claude Code SDK Streaming Integration Plan

## Overview

This document outlines the integration of Claude Code SDK's `stream-json` output format into PocketDev, enabling real-time progress updates for AI developer tasks.

## Stream-JSON Format Analysis

### Message Types

Based on the SDK documentation and our experiments, the stream-json format emits the following message types:

1. **System Init Message** (first message)
   ```json
   {
     "type": "system",
     "subtype": "init",
     "session_id": "uuid",
     "tools": ["Read", "Write", "Edit", ...],
     "mcp_servers": []
   }
   ```

2. **User Messages**
   ```json
   {
     "type": "user",
     "message": { /* Anthropic SDK MessageParam */ },
     "session_id": "uuid"
   }
   ```

3. **Assistant Messages** (streamed as they arrive)
   ```json
   {
     "type": "assistant",
     "message": { /* Anthropic SDK Message */ },
     "session_id": "uuid"
   }
   ```

4. **Result Message** (final message)
   ```json
   {
     "type": "result",
     "subtype": "success" | "error_max_turns",
     "cost_usd": 0.003,
     "duration_ms": 1234,
     "duration_api_ms": 800,
     "num_turns": 6,
     "result": "Final output text...",
     "session_id": "uuid"
   }
   ```

## Benefits for PocketDev

1. **Real-time Progress Updates**
   - Stream assistant messages as they arrive
   - Show tool usage in real-time
   - Update mobile UI progressively

2. **Cost Tracking**
   - Each result includes `cost_usd`
   - Track spending per AI developer
   - Budget management features

3. **Performance Metrics**
   - Execution time tracking (`duration_ms`)
   - API response time (`duration_api_ms`)
   - Number of reasoning turns

4. **Session Management**
   - Persistent `session_id` for each task
   - Resume interrupted tasks
   - Link tasks to conversations

## Integration Architecture

### 1. Update Container Task Manager

Modify `container-task-manager.js` to use streaming:

```javascript
// Instead of current approach:
const result = await this.runClaudeInContainer(task);

// Use streaming approach:
const executor = new ClaudeStreamExecutor(options);
executor.on('tool_use', (data) => {
  // Send real-time update via WebSocket
  this.sendProgressUpdate(task.id, data);
});
const result = await executor.executeTask(prompt, context);
```

### 2. WebSocket Events

Add new WebSocket event types for streaming updates:

```javascript
// Server-side events
socket.emit('task:stream:init', { taskId, sessionId, tools });
socket.emit('task:stream:tool_use', { taskId, tool, input });
socket.emit('task:stream:progress', { taskId, message });
socket.emit('task:stream:complete', { taskId, result, cost, duration });
```

### 3. Frontend Updates

Update React components to handle streaming:

```typescript
// TaskProgress.tsx
useEffect(() => {
  socket.on('task:stream:tool_use', (data) => {
    setCurrentTool(data.tool);
    addToActivityLog(data);
  });
  
  socket.on('task:stream:progress', (data) => {
    setProgress(data.progress);
  });
}, []);
```

### 4. Database Schema Updates

Add fields to track streaming metadata:

```sql
-- Add to tasks table
ALTER TABLE tasks ADD COLUMN session_id VARCHAR(255);
ALTER TABLE tasks ADD COLUMN cost_usd DECIMAL(10, 6);
ALTER TABLE tasks ADD COLUMN duration_ms INTEGER;
ALTER TABLE tasks ADD COLUMN api_duration_ms INTEGER;
ALTER TABLE tasks ADD COLUMN num_turns INTEGER;

-- New table for task events
CREATE TABLE task_events (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id),
  event_type VARCHAR(50),
  event_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Implementation Steps

1. **Phase 1: Core Integration** (Week 1)
   - [ ] Create `ClaudeStreamExecutor` class
   - [ ] Update container task execution logic
   - [ ] Add WebSocket event handlers
   - [ ] Store session IDs in database

2. **Phase 2: UI Updates** (Week 2)
   - [ ] Update TaskProgress component
   - [ ] Add real-time tool usage display
   - [ ] Show cost accumulation
   - [ ] Display execution metrics

3. **Phase 3: Advanced Features** (Week 3)
   - [ ] Implement task resumption
   - [ ] Add cost budgeting
   - [ ] Create activity timeline
   - [ ] Export execution logs

## Testing Strategy

1. **Unit Tests**
   - Test message parsing
   - Verify event emission
   - Mock Claude process

2. **Integration Tests**
   - End-to-end streaming flow
   - WebSocket communication
   - Database persistence

3. **Performance Tests**
   - Message throughput
   - UI responsiveness
   - Memory usage

## Example Usage

```javascript
// In container-routes.js
app.post('/api/containers/:id/tasks', async (req, res) => {
  const { engineerId, description } = req.body;
  
  // Create task with streaming support
  const task = await taskManager.createTask({
    engineerId,
    description,
    streaming: true  // Enable streaming
  });
  
  // Execute with real-time updates
  taskManager.executeStreamingTask(task, (event) => {
    // Send event to connected clients
    io.to(`engineer-${engineerId}`).emit(event.type, event.data);
  });
  
  res.json({ task });
});
```

## Migration Path

1. Keep existing non-streaming mode as default
2. Add `streaming` flag to enable new behavior
3. Gradually migrate features to streaming
4. Remove old implementation after validation

## Security Considerations

- Validate all streamed messages
- Sanitize output before sending to clients
- Rate limit WebSocket events
- Implement proper error boundaries

## Next Steps

1. Review experiments in `/experiments` directory
2. Run `./experiments/run-stream-test.sh` to see live demo
3. Implement `ClaudeStreamExecutor` in production code
4. Update frontend components for real-time updates