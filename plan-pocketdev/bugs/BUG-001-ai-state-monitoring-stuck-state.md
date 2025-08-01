# BUG: AI State Monitoring Gets Stuck in Incorrect State

**Priority**: High  
**Component**: Backend AI State Monitoring  
**First Reported**: 2025-07-31  
**Status**: ✅ FIXED - Root cause confirmed and fix implemented

## Issue Description
The AI state monitoring system fails to properly return to the "not-started" (gray) state when Claude exits and the terminal returns to the bash prompt. Multiple sessions are showing incorrect states, indicating a systemic issue with state detection and transitions.

## Observed Behavior
- Sessions remain in "idle" (blue), "working" (yellow), or "waiting" (purple) states even after Claude has exited
- The bash prompt is visible in the terminal, but the state doesn't update to "not-started" (gray)
- Multiple sessions affected, suggesting a pattern detection or state management issue

## Expected Behavior
When Claude exits and the terminal shows the bash prompt (`root@<container>:/<path>#`), the AI state should immediately transition to "not-started" (gray).

## Root Cause Analysis

### PRIMARY HYPOTHESIS: Bash Prompt Pattern Mismatch (95% confidence)
**Strong evidence suggests the bash prompt pattern in the AI monitor is outdated!**

The AI monitor is looking for: `root@<container>:/<path>#`
But the actual prompt is: `<username>$ ` (from PS1="\u\$ ")

This would explain why the bash prompt is never detected and sessions remain stuck in incorrect states.

**Testing Strategy:**
1. Add debug logging to capture the actual terminal output when Claude exits
2. Test the current regex pattern against sample bash prompts
3. Deploy the fix to a test environment and verify state transitions
4. Monitor for edge cases where the pattern might not match

### Hypothesis 1: Pattern Matching Conflict (85% confidence)
**Theory**: The bash prompt pattern is not being detected reliably due to:
1. **ANSI escape sequence interference**: The pattern matching operates on cleaned data (line 275 in ai-session-monitor.js), but the bash prompt detection (line 372) may be checking against data that still contains control sequences
2. **Timing issues**: The bash prompt appears gradually as Claude exits, potentially arriving in fragments that don't match the pattern
3. **Pattern priority conflict**: Other patterns (like claude-prompt or thinking animations) may be persisting in the buffer and preventing bash prompt detection

**Test Strategy**:
1. Add debug logging to track exactly what data is being checked for bash prompt
2. Log when bash prompt pattern is checked vs when it matches
3. Monitor the `recentPatterns` Map to see if stale patterns are interfering

### Hypothesis 2: State Tracker Persistence (65% confidence)
**Theory**: The state tracker is maintaining stale state due to:
1. **Recent patterns cache**: The `recentPatterns` Map (line 252) holds patterns for 2 seconds, which might cause Claude patterns to override bash prompt detection
2. **Partial data processing**: The bash prompt might arrive in chunks, with early chunks triggering other patterns before the full prompt is visible
3. **Missing state transitions**: The code only updates state when patterns change, not when patterns disappear

**Test Strategy**:
1. Monitor the lifecycle of entries in `recentPatterns` Map
2. Check if bash prompt arrives as complete string or fragments
3. Add logging for state transitions and their triggers

### Hypothesis 3: Session ID Mismatch (40% confidence)
**Theory**: The state updates might be failing due to:
1. **Session ID format changes**: The code expects `task-{taskId}-{dbSessionId}` format, but sessions might have different formats
2. **Database update failures**: The `updateSessionAIState` call (line 505) might be failing silently
3. **WebSocket broadcast issues**: State updates might not be reaching the frontend

**Test Strategy**:
1. Log all session IDs being processed and their formats
2. Add error handling and logging around database updates
3. Monitor WebSocket event delivery

## Critical Code Sections

### Pattern Detection Flow (ai-session-monitor.js)
```javascript
// Line 372-385: Bash prompt detection
let foundBashPrompt = false;
if (cleanData.match(/root@[\w-]+:[\w/~-]+#\s*$/)) {
  foundBashPrompt = true;
}

if (foundBashPrompt) {
  console.log(`Bash prompt found for ${sessionId}, current state: ${tracker?.currentState}`);
  if (tracker && tracker.currentState !== 'not-started') {
    console.log('Bash prompt detected - Claude exited, changing state from', tracker.currentState, 'to not-started');
    tracker.updateState('not-started', { context: 'bash' });
    this.broadcastStateUpdate(sessionId, tracker.getStatus());
  }
  return;
}
```

### Pattern Priority System
The current priority order (lines 369-373):
1. Bash prompt = 'not-started' (highest priority)
2. Thinking animation = 'working'
3. Multi-line input = 'waiting'
4. Single-line prompt = 'idle'

## Recommended Fix

Update the bash prompt pattern in `ai-session-monitor.js` to match the actual prompt format:

```javascript
// Old pattern (line 201 and 372):
pattern: /root@[\w-]+:[\w/~-]+#\s*$/

// New pattern to match "\u\$ " format:
pattern: /\w+\$\s*$/
```

This simpler pattern will match:
- `root$ `
- `pocketdev$ `
- Any username followed by `$ ` and optional whitespace

The fix needs to be applied in two places:
1. Line 201: In the pattern definition for 'bash-prompt'
2. Line 372: In the direct pattern check for foundBashPrompt

## Additional Context for Engineers

### Where to Find the Code
- **Primary file**: `/backend/ai-session-monitor.js`
  - Line 201: Pattern definition in the patterns object
  - Line 372: Direct pattern check in the state detection logic
- **Related files**:
  - `/backend/ai-state-tracker.js` - State management logic
  - `/frontend/src/components/task/TaskStatus.tsx` - UI display
  - `/frontend/src/hooks/useTaskStatus.ts` - Frontend state updates

### Important Considerations
1. **ANSI Escape Sequences**: The code strips ANSI codes before pattern matching (line 275), so the pattern should match the cleaned version
2. **Pattern Cache**: There's a 2-second pattern cache that might affect testing - wait at least 2 seconds between tests
3. **State Priority**: Bash prompt has highest priority and should override all other states
4. **Multiple Sessions**: The bug affects aggregate state calculation across multiple terminal tabs

### Quick Test Command
```bash
# To quickly test if the fix works, you can modify the pattern live:
docker exec -it pocketdev-backend-1 sed -i 's/root@\[\\w-\]+:\[\\w\/~-\]+#/\\w+\\$/g' /app/ai-session-monitor.js
# Then restart the backend container to apply changes
```

## Testing Plan

### 1. Verify Current Prompt Format
```bash
# Check what the actual prompt looks like in a task terminal
docker exec -it pocketdev-backend-1 bash -c 'echo "PS1=$PS1"'
docker exec -it pocketdev-shelltender-1 bash -c 'echo "$PS1"'
```

### 2. Test Pattern Matching
```javascript
// Test current pattern against actual prompts
const currentPattern = /root@[\w-]+:[\w/~-]+#\s*$/;
const newPattern = /\w+\$\s*$/;

// Test cases
const prompts = [
  "root$ ",
  "pocketdev$ ",
  "root@container:/app# ",
  "\u001b[32mroot\u001b[0m$ " // with ANSI codes
];

prompts.forEach(p => {
  console.log(`"${p}" - Current: ${currentPattern.test(p)}, New: ${newPattern.test(p)}`);
});
```

### 3. Debug Commands
```bash
# Monitor real-time state changes with enhanced logging
docker logs -f pocketdev-backend-1 2>&1 | grep -E "AIMonitor|state:|Bash prompt|Processing data"

# Check database state
docker exec -it pocketdev-backend-1 sqlite3 /app/data/pocketdev.db "SELECT id, shelltender_session_id, ai_state, tab_name FROM terminal_sessions WHERE is_active = 1;"

# Watch for bash prompt patterns in real-time
docker exec -it pocketdev-backend-1 tail -f /proc/1/fd/1 | grep -E "\w+\\\$\s*$"
```

### 4. Validation Steps
1. Open a task with Claude running
2. Exit Claude (Ctrl+D or 'exit')
3. Verify the prompt appears
4. Check if state transitions to 'not-started'
5. Repeat with different terminal configurations

---

## 🔧 RESOLUTION

**Date Fixed**: 2025-07-31  
**Engineer**: Claude Code Assistant  
**Root Cause Confirmed**: Bash prompt pattern mismatch

### What Was Wrong
The AI monitor was using an outdated bash prompt pattern that only matched legacy format:
```javascript
// OLD PATTERN (only matched legacy format)
/root@[\w-]+:[\w/~-]+#\s*$/
```

But the current shelltender configuration uses a different prompt format:
```bash
# From /etc/bash.bashrc in shelltender container
PS1='\[\033[32m\]\u\[\033[0m\]\$ '
# This produces prompts like: root$  or  pocketdev$
```

### Fix Applied
Updated the bash prompt pattern in two locations in `/backend/ai-session-monitor.js`:

1. **Line 201-202**: Pattern definition in bash-prompt configuration
2. **Line 374**: Direct pattern check in state detection logic

**New Pattern** (supports both formats):
```javascript
/(?:root@[\w-]+:[\w/~-]+#|\w+\$)\s*$/
```

This combined pattern matches:
- ✅ Current format: `root$ `, `pocketdev$ `, `user$ `
- ✅ Legacy format: `root@container:/path# `
- ✅ With ANSI color codes (properly stripped)
- ❌ Claude prompts and other non-bash output

### Verification Results
- ✅ Pattern matching tests: All pass
- ✅ ANSI escape sequence handling: Working correctly
- ✅ Backward compatibility: Legacy format still supported
- ✅ Backend service: Restarted and healthy
- ✅ Fix integration: Changes applied and active

### Expected Outcome
Sessions that show bash prompts should now correctly transition to 'not-started' (gray) state when:
1. Claude exits and returns to bash prompt
2. User is at the terminal prompt between commands
3. Terminal shows the shell prompt after command execution

The fix resolves the systemic issue where sessions remained stuck in 'idle', 'working', or 'waiting' states when they should have returned to 'not-started'.

### Files Modified
- `/backend/ai-session-monitor.js` (lines 201-202, 374)

**Status**: ✅ Bug fixed and verified