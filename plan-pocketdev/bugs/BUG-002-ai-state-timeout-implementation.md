# Implementation Plan: Timeout-Based State Detection

<!-- Document Metadata
Created: 2025-07-31
Modified: 2025-07-31
Status: ????
-->


## Context
The AI state monitoring system is getting stuck in incorrect states (idle/working/waiting) when Claude exits. Currently it tries to detect bash prompts to know when to transition to 'not-started' (gray), but this is fragile and not working with current prompt configurations.

## Summary
Replace bash prompt detection with a simpler approach:
1. Remove bash prompt pattern matching entirely
2. Add timeout mechanism: If no Claude UI patterns detected for 5 seconds while in an active state → transition to `not-started`

## File to Modify
`/home/jeffh/projects/pocketdev/backend/ai-session-monitor.js`

## Implementation Details

### 1. Remove Bash Prompt Detection
- Delete the `bash-prompt` pattern definition (lines 199-213)
- Remove the bash prompt check logic (lines 370-385)

### 2. Add Timeout Mechanism

Find the `setupGlobalMonitoring()` method (around line 244) and add the following:

```javascript
// First, enhance the recentPatterns Map initialization (around line 253):
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
In the pattern matching section (around lines 310-345), whenever a Claude pattern is detected, add:
```javascript
// After detecting any Claude pattern (thinking, prompt, confirmation)
if (patternName.startsWith('claude-')) {
  recent.lastClaudeActivity = Date.now();
}
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

## Important Notes
- The timeout mechanism should be added AFTER the existing pattern initialization code
- Make sure to clean up the interval when the monitor is destroyed (if there's a cleanup method)
- The 5-second timeout is conservative - can be adjusted if needed
- Don't forget to remove ALL references to bash prompt detection, including the pattern in the patterns object around line 200