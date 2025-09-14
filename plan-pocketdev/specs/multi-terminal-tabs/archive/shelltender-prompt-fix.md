# Shelltender Prompt Fix for Auto-Launch

<!-- Document Metadata
Created: 2025-07-28
Modified: 2025-07-28
Status: ????
-->


## The Problem
Shelltender terminals don't always show a bash prompt immediately after creation, which prevents our auto-launch from working reliably. The Shelltender demo app doesn't do any special prompt handling - it relies on bash's default behavior.

## The Solution
Based on how the Shelltender demo app works, we need to:

1. **Force prompt display** after terminal creation by sending a newline
2. **Wait longer** for the terminal to be fully ready (3 seconds instead of 2)
3. **Send an empty command first** to ensure the prompt is visible before sending 'claude'

## Implementation Changes

### DirectTerminal.tsx
Added `onSessionCreated` callback to force prompt display:
```javascript
onSessionCreated={(sessionId: string) => {
  // Force prompt display by sending a newline
  setTimeout(() => {
    wsService.send({
      type: 'input',
      sessionId: sessionId,
      data: '\n'
    });
  }, 500);
}}
```

### TerminalPanel.tsx
Updated auto-launch sequence:
1. Wait 3 seconds for terminal to be ready
2. Send empty command to force prompt
3. Wait 500ms
4. Send 'claude' command

## Why This Works
- Shelltender creates a PTY with `/bin/bash -l` (login shell)
- Login shells may not immediately show a prompt
- Sending a newline forces bash to display its prompt
- The empty command ensures the terminal is responsive before sending 'claude'

## Testing
1. Click the plus button to create a new tab
2. Watch the console logs for the sequence:
   - Session created
   - Forcing prompt display (in terminal)
   - Sending newline to force prompt (in panel)
   - Sending claude command
3. Claude should start automatically

## Future Improvements
- Consider adding a more robust "terminal ready" detection
- Maybe check for actual prompt patterns in terminal output
- Could add retry logic if Claude command fails