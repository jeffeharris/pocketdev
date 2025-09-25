# Shelltender v0.4.1 Upgrade Implementation Plan

<!-- Document Metadata
Created: 2025-07-11
Modified: 2025-07-11
Status: ????
-->


## Overview
This document outlines the steps to upgrade from @shelltender/client v0.3.0 to v0.4.1, taking advantage of the new Terminal ref API with focus() and fit() methods.

## Key Improvements in v0.4.0/0.4.1
- ✅ **Resize handling fixed** - ResizeObserver properly handles window resize events
- ✅ **Terminal ref API** - Exposes `TerminalHandle` type with `fit()` and `focus()` methods
- ✅ **No breaking changes** - Direct upgrade path
- ✅ **Better customization** - Font size, themes, padding options
- ✅ **Debug mode** - Built-in debugging for resize/focus issues

## Implementation Steps

### 1. Update Package Version
```bash
cd simple/frontend
npm install @shelltender/client@^0.4.1
```

### 2. Update DirectTerminal Component

**File:** `/simple/frontend/src/components/terminal/DirectTerminal.tsx`

```typescript
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Terminal, TerminalHandle, WebSocketProvider } from '@shelltender/client';

export type DirectTerminalHandle = {
  focus: () => void;
  fit: () => void;
};

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

  // Expose both focus and fit methods to parent components
  useImperativeHandle(ref, () => ({
    focus: () => {
      console.log('[DirectTerminal] Focus called for task:', taskId);
      terminalRef.current?.focus();
    },
    fit: () => {
      console.log('[DirectTerminal] Fit called for task:', taskId);
      terminalRef.current?.fit();
    }
  }), [taskId]);

  // Auto-fit when becoming visible
  useEffect(() => {
    if (isVisible && terminalRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        terminalRef.current?.fit();
      }, 0);
    }
  }, [isVisible]);

  // Configure WebSocket URL to use our proxy
  const websocketUrl = window.location.protocol === 'https:' 
    ? `wss://${window.location.host}/shelltender-ws`
    : `ws://${window.location.host}/shelltender-ws`;

  console.log('[DirectTerminal] Rendering terminal for task:', taskId, 'sessionId:', terminalSessionId);

  return (
    <div className={`w-full h-full overflow-hidden ${className}`} style={{ display: isVisible ? 'block' : 'none' }}>
      <WebSocketProvider config={{ url: websocketUrl }}>
        <Terminal
          ref={terminalRef}
          sessionId={terminalSessionId}
          onSessionCreated={(newSessionId: string) => {
            console.log('[DirectTerminal] Session created:', newSessionId);
          }}
          // New customization options
          fontSize={14}
          theme={{ 
            background: '#1e1e1e',
            foreground: '#d4d4d4'
          }}
          padding={{ left: 8 }}
          // Enable debug mode during development
          debug={process.env.NODE_ENV === 'development'}
        />
      </WebSocketProvider>
    </div>
  );
});

DirectTerminalComponent.displayName = 'DirectTerminal';

export const DirectTerminal = DirectTerminalComponent;
```

### 3. Update TerminalPanel Component

**File:** `/simple/frontend/src/components/terminal/TerminalPanel.tsx`

Update the focus handling to use the new clean API:

```typescript
// In the selectTask function
const selectTask = useCallback((task: Task) => {
  setSelectedTask(task);
  
  // Focus terminal after a short delay to ensure visibility
  setTimeout(() => {
    const ref = terminalRefs.current.get(task.id);
    if (ref?.current) {
      ref.current.fit();    // Ensure proper sizing
      ref.current.focus();  // Focus the terminal
    }
  }, 100);
}, []);
```

### 4. Remove Legacy Workarounds

**Remove from ShelltenderFrame.tsx:**
- Remove the iframe ref and postMessage logic
- Remove the focus method implementation using contentWindow
- This component can likely be deprecated entirely in favor of DirectTerminal

### 5. Update TaskWorkspace Component

**File:** `/simple/frontend/src/components/task/TaskWorkspace.tsx`

Ensure the focus is properly triggered when switching tasks:

```typescript
useEffect(() => {
  if (activeTab === 'terminal' && terminalRef.current) {
    // Small delay to ensure terminal is visible
    setTimeout(() => {
      terminalRef.current?.fit();
      terminalRef.current?.focus();
    }, 100);
  }
}, [activeTab, task.id]);
```

### 6. Testing Plan

1. **Resize Testing:**
   - Open a terminal
   - Resize the browser window
   - Verify terminal automatically adjusts without manual intervention
   - Check console for resize logs if debug mode is enabled

2. **Focus Testing:**
   - Switch between multiple tasks
   - Verify keyboard input goes to the active terminal
   - Test clicking outside and back into terminal
   - Verify focus is maintained across tab switches

3. **Performance Testing:**
   - Create multiple terminals
   - Switch rapidly between tasks
   - Verify no memory leaks or performance degradation

### 7. Cleanup Tasks

1. **Remove ShelltenderFrame component** - No longer needed with DirectTerminal
2. **Remove iframe-related code** - All postMessage workarounds
3. **Update imports** - Ensure all components import from DirectTerminal
4. **Remove shelltender-terminal.html** - Legacy file no longer needed

### 8. Optional Enhancements

With the new API, consider adding:

1. **Keyboard shortcuts for terminal operations:**
   ```typescript
   // Ctrl+Shift+F to fit terminal
   useEffect(() => {
     const handleKeydown = (e: KeyboardEvent) => {
       if (e.ctrlKey && e.shiftKey && e.key === 'F') {
         terminalRef.current?.fit();
       }
     };
     window.addEventListener('keydown', handleKeydown);
     return () => window.removeEventListener('keydown', handleKeydown);
   }, []);
   ```

2. **Auto-focus on task creation:**
   ```typescript
   onSessionCreated={(newSessionId: string) => {
     console.log('[DirectTerminal] Session created:', newSessionId);
     // Auto-focus new terminals
     setTimeout(() => {
       terminalRef.current?.focus();
     }, 100);
   }}
   ```

3. **Theme customization based on user preferences:**
   ```typescript
   const theme = useUserTheme(); // Custom hook for theme preferences
   
   <Terminal
     ref={terminalRef}
     theme={theme}
     // ... other props
   />
   ```

## Migration Checklist

- [ ] Update package.json to @shelltender/client@^0.4.1
- [ ] Run npm install
- [ ] Update DirectTerminal component with new ref implementation
- [ ] Update TerminalPanel to use new focus/fit methods
- [ ] Update TaskWorkspace focus handling
- [ ] Remove ShelltenderFrame component and related imports
- [ ] Test resize functionality across different scenarios
- [ ] Test focus behavior when switching tasks
- [ ] Remove all iframe/postMessage workarounds
- [ ] Update TypeScript imports to use TerminalHandle type
- [ ] Enable debug mode in development for troubleshooting
- [ ] Document any custom theme configurations

## Notes

- The focus() method requires v0.4.1 (not available in v0.4.0)
- Keep terminals mounted but hidden for best performance
- Use setTimeout with 0-100ms delay when showing hidden terminals
- The debug prop is helpful during development but should be disabled in production

## Success Criteria

1. Terminal resizes automatically when window size changes
2. Terminal receives focus immediately when switching tasks
3. No console errors or warnings
4. Improved user experience with instant focus
5. Cleaner codebase without workarounds