# Shelltender v0.4.2 Implementation Guide for Claude

<!-- Document Metadata
Created: 2025-07-11
Modified: 2025-07-11
Status: ????
-->


This guide provides exact instructions for Claude to implement Shelltender v0.4.2 updates. The v0.4.2 release fixes the WebSocket configuration bug where Terminal ignored WebSocketProvider configuration.

## Pre-Implementation Environment Check

Execute these commands to verify current state:

```bash
# Check all prerequisites in parallel
pwd  # Should show /home/jeffh/projects/pocketdev/simple/frontend
grep "@shelltender/client" package.json | grep -o '"[^"]*"$'  # Should show "^0.4.1"
npm list @shelltender/client | grep @shelltender/client  # Verify installed version
ls -la src/components/terminal/DirectTerminal.tsx  # Ensure file exists
git status --short  # Note any uncommitted changes
```

**Environment Checklist:**
- [ ] Current directory is simple/frontend
- [ ] @shelltender/client is at v0.4.1 or v0.4.0
- [ ] DirectTerminal.tsx has been read
- [ ] Current git branch noted

## State Tracking

Initialize and maintain throughout implementation:

```typescript
const implementationState = {
  // Version Management
  CURRENT_VERSION: "0.4.1",
  TARGET_VERSION: "0.4.2",
  
  // Implementation Progress
  STEPS_COMPLETED: [],
  WEBSOCKET_CONFIG: {
    method: "",  // "environment" | "window" | "package.json"
    url: ""
  },
  
  // Component Updates
  COMPONENTS_UPDATED: {
    "DirectTerminal": false,
    "package.json": false,
    "environment": false
  },
  
  // Test Results
  REF_TEST: "not_tested",      // "working" | "failed"
  FOCUS_TEST: "not_tested",    // "working" | "failed"
  CONNECTION_TEST: "not_tested" // "working" | "failed"
};
```

## Claude Tool Usage Pattern

1. **Start with TodoWrite** - Create these 8 implementation steps:
   ```
   - Step 1: Read current DirectTerminal implementation
   - Step 2: Implement WebSocket URL configuration
   - Step 3: Remove WebSocketProvider wrapper
   - Step 4: Update Terminal component usage
   - Step 5: Test WebSocket connection
   - Step 6: Test ref callback execution
   - Step 7: Implement focus/fit functionality
   - Step 8: Verify and commit changes
   ```

2. **Always Read before Edit** - Never assume file contents

3. **Test after each change** - Verify WebSocket connection before proceeding

## Step 1: Read Current Implementation

```bash
# Read the current DirectTerminal component
Read src/components/terminal/DirectTerminal.tsx

# Check for WebSocketProvider usage
grep -n "WebSocketProvider" src/components/terminal/DirectTerminal.tsx
```

## Step 2: Update Package to v0.4.2

```bash
# Update package.json
Edit simple/frontend/package.json
Change: "@shelltender/client": "^0.4.1" → "@shelltender/client": "^0.4.2"

# Clean install
rm -rf node_modules package-lock.json
npm install

# Verify installation
npm list @shelltender/client | grep @shelltender/client
# Should show: @shelltender/client@0.4.2
```

## Step 3: Add WebSocketProvider with Configuration

**CRITICAL CHANGE in v0.4.2:** WebSocketProvider now works correctly! Terminal uses the shared WebSocket service.

```typescript
// Configure WebSocket URL based on environment
const getWebSocketUrl = () => {
  // For production
  if (window.location.protocol === 'https:') {
    return `wss://${window.location.host}/shelltender-ws`;
  }
  // For development with Vite proxy
  return '/shelltender-ws';
};

const wsConfig = {
  url: getWebSocketUrl()
};
```

## Step 4: Update DirectTerminal Component

**COMPLETE IMPLEMENTATION with WebSocketProvider:**

```typescript
import React, { useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Terminal, TerminalHandle, WebSocketProvider } from '@shelltender/client';

export interface DirectTerminalHandle {
  focus: () => void;
  fit: () => void;
}

interface DirectTerminalProps {
  taskId: string;
  sessionId?: string;
  className?: string;
  worktreePath?: string;
  isVisible?: boolean;
}

const DirectTerminalComponent = forwardRef<DirectTerminalHandle, DirectTerminalProps>(({ 
  taskId, 
  sessionId,
  className = '',
  worktreePath,
  isVisible = true
}, ref) => {
  const terminalSessionId = sessionId || `task-${taskId}`;
  const terminalRef = useRef<TerminalHandle>(null);
  
  // Configure WebSocket URL
  const wsConfig = {
    url: window.location.protocol === 'https:' 
      ? `wss://${window.location.host}/shelltender-ws`
      : `/shelltender-ws`  // Vite proxy in development
  };
  
  console.log('[DirectTerminal] WebSocket config:', wsConfig);

  // Expose methods via imperative handle
  useImperativeHandle(ref, () => ({
    focus: () => {
      console.log('[DirectTerminal] Focus called for task:', taskId);
      if (terminalRef.current?.focus) {
        terminalRef.current.focus();
        console.log('[DirectTerminal] Focus executed successfully');
      } else {
        console.warn('[DirectTerminal] Terminal ref not available for focus');
      }
    },
    fit: () => {
      console.log('[DirectTerminal] Fit called for task:', taskId);
      if (terminalRef.current?.fit) {
        terminalRef.current.fit();
        console.log('[DirectTerminal] Fit executed successfully');
      } else {
        console.warn('[DirectTerminal] Terminal ref not available for fit');
      }
    }
  }), [taskId]);

  // Auto-fit when becoming visible
  useEffect(() => {
    if (isVisible && terminalRef.current) {
      const timer = setTimeout(() => {
        console.log('[DirectTerminal] Auto-fitting terminal for task:', taskId);
        terminalRef.current?.fit();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isVisible, taskId]);

  console.log('[DirectTerminal] Rendering terminal for task:', taskId, 'sessionId:', terminalSessionId);

  return (
    <div className={`w-full h-full overflow-hidden ${className}`} style={{ display: isVisible ? 'block' : 'none' }}>
      <WebSocketProvider config={wsConfig}>
        <Terminal
          ref={terminalRef}
          sessionId={terminalSessionId}
          onSessionCreated={(newSessionId: string) => {
            console.log('[DirectTerminal] Session created:', newSessionId);
            // Auto-focus new terminals after a delay
            setTimeout(() => {
              if (terminalRef.current?.focus) {
                terminalRef.current.focus();
                console.log('[DirectTerminal] Auto-focused new terminal');
              }
            }, 200);
          }}
          debug={true}
        />
      </WebSocketProvider>
    </div>
  );
});

DirectTerminalComponent.displayName = 'DirectTerminal';

export const DirectTerminal = DirectTerminalComponent;
```

## Step 5: Test WebSocket Connection

```bash
# Start dev server
npm run dev

# In browser console, check:
# 1. Look for "[DirectTerminal] WebSocket config:" log
# 2. Check Network tab for WebSocket connection
# 3. Should see connection to /shelltender-ws (proxied to your backend)
```

**Connection Verification:**
- Network tab should show WebSocket connection to `/shelltender-ws`
- No more hardcoded `ws://localhost:8081` connections
- Terminal should render without connection errors

## Step 6: Test Ref Callback

**Test Protocol:**
1. Open browser with DevTools Console
2. Load a task with terminal
3. Look for logs:
   - `[DirectTerminal] Terminal ref callback: [object]`
   - `[DirectTerminal] Ref updated: true`

**Success Criteria:**
- Ref callback logs show non-null object
- No WebSocket connection errors
- Terminal renders visually

## Step 7: Test Focus/Fit Functionality

**Focus Test:**
```typescript
// In browser console after terminal loads
// Find the DirectTerminal component and test:
// 1. Switch away from terminal tab
// 2. Switch back
// 3. Should see "[DirectTerminal] Focus called" log
// 4. Cursor should be blinking in terminal
```

**Fit Test:**
```typescript
// Resize browser window
// Should see terminal adjust without scrollbars
// Look for "[DirectTerminal] Auto-fitting" logs
```

## Step 8: Commit Changes

**Pre-commit Checklist:**
- [ ] WebSocket connects to correct URL
- [ ] Ref callback executes (logs show object)
- [ ] Focus method works (cursor appears)
- [ ] Fit method works (no scrollbars on resize)
- [ ] No TypeScript errors

```bash
# Stage changes
git add -A

# Commit with detailed message
git commit -m "feat: Implement Shelltender v0.4.2 WebSocket configuration

- Configured WebSocket URL via environment variable/window global
- Removed WebSocketProvider wrapper per Shelltender team guidance
- Terminal now manages its own WebSocket connection
- Fixed ref callback to properly receive terminal instance
- Implemented focus() and fit() methods with logging
- Auto-focus on new terminal creation
- Auto-fit when terminal becomes visible

WebSocket now connects to configured proxy URL instead of hardcoded localhost:8081

Testing confirms:
- Ref callback executes and provides terminal instance
- Focus works immediately when switching tasks
- Terminal resizes properly with window

Fixes WebSocket connection issues that prevented ref initialization

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Troubleshooting Decision Tree

```
Terminal ref is null?
├─ Check browser console for WebSocket errors
│  └─ Connection failed? → Verify proxy configuration
├─ Check for "[Terminal] WebSocket service not available" error
│  └─ YES → WebSocketProvider missing or misconfigured
├─ Using v0.4.2?
│  └─ NO → Must upgrade from v0.4.1 for fix
└─ Terminal wrapped in WebSocketProvider?
   └─ NO → Wrap Terminal with WebSocketProvider

Focus not working?
├─ Is ref.current null?
│  └─ YES → See "Terminal ref is null?" above
├─ Check console for focus logs
│  └─ No logs? → Ref might not be properly typed
└─ Terminal visible?
   └─ NO → Can't focus hidden terminal

WebSocket connection issues?
├─ Check Network tab for /shelltender-ws
│  └─ 404? → Vite proxy not configured
├─ Using correct WebSocketProvider config?
│  └─ Should have: config={{ url: '/shelltender-ws' }}
└─ Backend running on expected port?
   └─ Verify shelltender service on port 8081
```

## Success Verification Commands

```bash
# Quick verification in browser console
console.log('=== Shelltender v0.4.2 Verification ===');
console.log('WebSocket URL:', window.SHELLTENDER_WS_URL);
console.log('Terminal refs:', document.querySelectorAll('[class*="xterm"]').length);
console.log('=== Check Network tab for WS connection ===');
```

## Communication Template

When complete:
```
✅ Shelltender v0.4.2 upgrade completed!

Key fix: WebSocketProvider configuration now works correctly.

Test results:
- WebSocket Connection: ✅ Connects via proxy at /shelltender-ws
- Ref Callback: ✅ Terminal ref properly set
- Focus Method: ✅ Works on task switch
- Fit Method: ✅ Resizes with window

The v0.4.2 fix:
- Terminal now uses shared WebSocket service from useWebSocket hook
- WebSocketProvider config is respected (was ignored in v0.4.1)
- No more hardcoded ws://localhost:8081 connections
```

## Success Criteria Summary

1. **Package Version**: v0.4.2 installed
2. **WebSocket**: Connects to proxied URL (not localhost:8081)
3. **Terminal Ref**: Properly set and accessible
4. **Focus/Fit**: Methods work as expected
5. **No Console Errors**: Clean console output

## Key Changes from v0.4.1

- ✅ WebSocketProvider configuration works
- ✅ Terminal uses shared WebSocket service
- ✅ No need for window.SHELLTENDER_WS_URL workarounds
- ✅ Proper resource sharing across terminals