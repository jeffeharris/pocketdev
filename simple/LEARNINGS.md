# Learnings from PocketDev Simple Server Implementation

## Key Technical Discoveries

### 1. Claude CLI Streaming JSON Format

The `--output-format stream-json` flag provides detailed execution information, but the structure differs from documentation:

- Tool usage is embedded within assistant messages, not as separate `tool_use` message types
- Assistant messages contain a `content` array with tool_use objects
- Each line is a complete JSON object (newline-delimited JSON)

Example structure:
```json
{
  "type": "assistant",
  "message": {
    "role": "assistant",
    "content": [
      {
        "type": "tool_use",
        "id": "toolu_xyz",
        "name": "Edit",
        "input": {
          "file_path": "/path/to/file",
          "old_string": "...",
          "new_string": "..."
        }
      }
    ]
  }
}
```

### 2. Server-Sent Events (SSE) Race Condition

**Problem**: When executing Claude synchronously, by the time the frontend connected to the SSE stream, events had already been sent.

**Solution**: Return the task ID immediately and execute Claude asynchronously, giving the frontend time to establish the SSE connection.

```javascript
// Return immediately
res.json({ taskId, status: 'starting' });

// Execute asynchronously
executeClaudeTask(worktreePath, task, null, taskId)
  .then(result => { /* handle success */ })
  .catch(error => { /* handle error */ });
```

### 3. Claude Process Management

**Issue**: Claude would sometimes hang when spawned with a shell wrapper.

**Fix**: Spawn Claude directly and immediately close stdin:
```javascript
const claude = spawn('claude', args, {
  cwd: worktreePath,
  stdio: ['pipe', 'pipe', 'pipe']
});
claude.stdin.end(); // Critical to prevent hanging
```

### 4. Git Worktree Benefits

Using git worktrees provides excellent task isolation:
- Each task gets its own working directory
- No conflicts between concurrent tasks
- Easy cleanup with `git worktree remove`
- Branches are automatically tracked

### 5. Error Handling Insights

Claude exits with code 0 even on errors, returning status in the result message:
- `result.subtype === 'error_during_execution'` indicates failure
- `result.subtype === 'success'` indicates success
- Always check the result message, not just exit code

### 6. Configuration Management

**Lesson**: Environment variables are good for server settings, but user configuration should be file-based:
- Removed GitHub settings from docker-compose environment
- Store user config in `~/.pocketdev/config.json`
- Mount config directory as Docker volume for persistence

## Architecture Decisions That Worked Well

1. **Minimal Dependencies**: Using just Express.js and built-in Node modules kept it simple
2. **Single HTML File**: All frontend code in one file made iteration fast
3. **Memory Storage**: For POC/demo, in-memory task storage was sufficient
4. **Direct Claude CLI**: Using the official CLI provided reliable streaming

## Pain Points and Solutions

### 1. Debugging Streaming Issues
**Problem**: Hard to see what messages Claude was sending
**Solution**: Add comprehensive logging with message structure dumps

### 2. Frontend Not Updating
**Problem**: SSE events sent but UI not updating
**Solution**: Parse tool_use from assistant message content array

### 3. Accept/Push Hanging
**Problem**: Accept endpoint would hang trying to commit already-committed changes
**Solution**: Check git status before attempting commit

### 4. Docker Rebuilds
**Problem**: Changes not reflected after restart
**Solution**: Always use `--build` flag when code changes

## Best Practices Developed

1. **Always Log SSE Attempts**: Include client connection status
2. **Timeout Long Operations**: Add timeouts to prevent indefinite hangs
3. **Check Git State**: Verify repository state before operations
4. **Immediate Response**: Return task IDs immediately for better UX
5. **Structured Logging**: Use prefixes like `[SSE]` for easy filtering

## Streaming Integration Patterns

For real-time updates with Claude:

1. **Connect First**: Establish SSE before starting work
2. **Parse Nested Content**: Tool usage is in message.content array
3. **Handle All States**: Process init, activity, complete, and error
4. **Reconnect on Follow-up**: Re-establish SSE for continued work

## What Would I Do Differently?

1. **WebSockets over SSE**: More bidirectional control
2. **Task Queue**: Proper job queue for better reliability
3. **Structured Logging**: JSON logs from the start
4. **Test Harness**: Automated tests for streaming scenarios
5. **Error Recovery**: Better handling of partial failures

## Conclusion

The simple server successfully demonstrates core PocketDev concepts with minimal complexity. The streaming integration provides excellent user feedback, and git worktrees offer robust isolation. The main challenges were around timing and message parsing, both solvable with careful async handling and logging.