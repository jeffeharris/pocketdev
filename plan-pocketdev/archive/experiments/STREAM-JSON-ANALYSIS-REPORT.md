# Claude Code SDK Stream-JSON Analysis Report

<!-- Document Metadata
Created: 2025-07-11
Modified: 2025-07-11
Status: ????
-->


## Executive Summary

After running experiments with Claude Code SDK's `stream-json` output format, I've gathered comprehensive insights on how this feature can enhance PocketDev's real-time AI developer experience. The streaming format provides granular message-by-message updates that enable live progress tracking, cost monitoring, and interactive feedback loops.

## Key Findings

### 1. Message Structure and Flow

The stream-json format outputs newline-delimited JSON, with each line being a complete message object. The typical flow is:

```
1. System Init Message → 2. Assistant Messages → 3. User Messages (tool results) → 4. Result Message
```

#### Example Message Sequence:
```json
// First message - System initialization
{"type":"system","subtype":"init","session_id":"uuid","tools":[...],"model":"claude-opus-4-20250514"}

// Assistant working
{"type":"assistant","message":{...},"session_id":"uuid"}

// Tool usage
{"type":"assistant","message":{"content":[{"type":"tool_use","name":"LS","id":"toolu_..."}]}}

// Final result
{"type":"result","subtype":"success","cost_usd":0.139,"duration_ms":2867,"num_turns":1}
```

### 2. Important Requirements

- **Verbose Flag Required**: When using `--print` with `--output-format stream-json`, you MUST include `--verbose`
- **Real-time Streaming**: Messages arrive as Claude processes, not all at once
- **Session Persistence**: Each conversation has a unique `session_id` that can be used for resumption

### 3. Message Types Observed

#### System Init Message
- **Purpose**: Establishes session context
- **Key Fields**:
  - `session_id`: Unique identifier for the conversation
  - `tools`: Array of available tools
  - `model`: AI model being used
  - `cwd`: Current working directory
  - `permissionMode`: Security context

#### Assistant Messages
- **Purpose**: Show Claude's responses and actions
- **Key Fields**:
  - `message.content`: Array containing text and tool_use objects
  - `message.id`: Unique message identifier
  - `usage`: Token consumption details

#### User Messages
- **Purpose**: Contains tool results sent back to Claude
- **Key Fields**:
  - `content`: Tool results
  - `tool_use_id`: Links to the tool request

#### Result Message
- **Purpose**: Final summary with metrics
- **Key Fields**:
  - `cost_usd`: Exact cost (e.g., 0.13932625)
  - `duration_ms`: Total execution time
  - `duration_api_ms`: API response time
  - `num_turns`: Number of reasoning turns
  - `result`: Final output text
  - `subtype`: "success" or "error_max_turns"

### 4. Cost Analysis

From our experiments:
- Simple calculation ("2+2"): $0.139
- Directory listing with tool use: $0.227
- Costs are tracked to 8 decimal places
- Includes token usage breakdown:
  ```json
  "usage": {
    "input_tokens": 4,
    "cache_creation_input_tokens": 6531,
    "cache_read_input_tokens": 10216,
    "output_tokens": 6
  }
  ```

### 5. Performance Metrics

- **API Duration**: 5-11 seconds for simple tasks
- **Total Duration**: Includes local processing time
- **Real-time Updates**: Messages stream as they're generated
- **Tool Execution**: Tracked separately in assistant messages

## Integration Benefits for PocketDev

### 1. Real-Time Progress Tracking
```javascript
// Stream processing example
executor.on('assistant_message', (data) => {
  if (data.content.some(c => c.type === 'tool_use')) {
    updateUI({ status: 'Using tool', tool: data.content[0].name });
  }
});
```

### 2. Cost Management
- Track spending per AI developer
- Set budget alerts
- Show cost accumulation in real-time
- Historical cost analysis per project

### 3. Session Management
- Persist `session_id` in database
- Resume interrupted tasks
- Link multiple tasks to same conversation
- Maintain context across mobile app restarts

### 4. Enhanced User Experience
- Show which tools are being used
- Display progress indicators
- Real-time error detection
- Immediate feedback on task completion

## Implementation Recommendations

### 1. Update Container Task Manager
```javascript
class ClaudeStreamExecutor extends EventEmitter {
  async executeTask(prompt, context) {
    const args = [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--verbose',  // Required!
      '--max-turns', '10'
    ];
    // ... spawn and process
  }
}
```

### 2. WebSocket Integration
```javascript
// Real-time updates to mobile app
socket.emit('task:stream:update', {
  taskId,
  type: message.type,
  data: message
});
```

### 3. Database Schema Updates
```sql
ALTER TABLE tasks 
  ADD COLUMN session_id VARCHAR(255),
  ADD COLUMN cost_usd DECIMAL(10, 8),
  ADD COLUMN token_usage JSONB;
```

## Potential Challenges

1. **Message Volume**: Each task generates multiple messages
2. **Error Handling**: Need to handle streaming interruptions
3. **Cost Visibility**: High precision costs might surprise users
4. **Performance**: Streaming adds complexity to UI updates

## Conclusion

The stream-json format is ideal for PocketDev's vision of managing AI developers from mobile devices. It provides:
- Real-time visibility into AI operations
- Precise cost tracking
- Session persistence for reliability
- Tool usage monitoring for security

The streaming approach aligns perfectly with mobile-first UX requirements, enabling responsive interfaces that keep users informed without overwhelming them.

## Next Steps

1. Implement `ClaudeStreamExecutor` class
2. Update WebSocket handlers for streaming events
3. Modify UI components for real-time updates
4. Add cost tracking and budgeting features
5. Test with various task complexities
6. Monitor performance impact on mobile devices