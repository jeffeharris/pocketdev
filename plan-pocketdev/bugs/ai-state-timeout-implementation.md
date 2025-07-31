# Implementation Plan: Timeout-Based State Detection

## Summary
Replace bash prompt detection with a simpler approach:
1. Remove bash prompt pattern matching entirely
2. Add timeout mechanism: If no Claude UI patterns detected for X seconds while in an active state → transition to `not-started`

## Implementation Details

### 1. Remove Bash Prompt Detection
- Delete the `bash-prompt` pattern definition (lines 199-213)
- Remove the bash prompt check logic (lines 370-385)

### 2. Add Timeout Mechanism

```javascript
// In setupGlobalMonitoring(), enhance the recentPatterns tracking:
this.recentPatterns = new Map(); // sessionId -> { 
  // patterns: Set, 
  // lastUpdate: timestamp, 
  // lastThinking: timestamp,
  // lastClaudeActivity: timestamp  // NEW: track last time we saw ANY Claude pattern
}

// Add a periodic check (every 3 seconds):
setInterval(() => {
  const now = Date.now();
  const CLAUDE_TIMEOUT = 5000; // 5 seconds of no Claude activity
  
  this.recentPatterns.forEach((recent, sessionId) => {
    const tracker = this.stateTrackers.get(sessionId);
    if (!tracker) return;
    
    // If we're in an active state and haven't seen Claude patterns recently
    if (tracker.currentState !== 'not-started' && 
        recent.lastClaudeActivity && 
        (now - recent.lastClaudeActivity) > CLAUDE_TIMEOUT) {
      
      console.log(`Claude timeout for ${sessionId} - transitioning to not-started`);
      tracker.updateState('not-started', { reason: 'timeout' });
      this.broadcastStateUpdate(sessionId, tracker.getStatus());
    }
  });
}, 3000);
```

### 3. Update Pattern Detection
When ANY Claude pattern is detected (prompt, thinking, confirmation):
```javascript
recent.lastClaudeActivity = Date.now();
```

### 4. Claude UI Patterns to Track
- `claude-thinking` - Thinking animation
- `claude-processing` - Initial processing
- `claude-prompt` - Input prompt box
- `claude-confirmation` - Confirmation/options box
- `claude-welcome` - Welcome message

## Benefits
- No fragile shell prompt detection
- Works with any shell/prompt configuration
- Simple and deterministic
- Handles edge cases where Claude crashes or disconnects

## Testing
1. Start Claude in a task
2. Exit Claude normally → should transition to `not-started` within 5 seconds
3. Kill Claude process → should transition to `not-started` within 5 seconds
4. Test with different shells/prompts → should work consistently