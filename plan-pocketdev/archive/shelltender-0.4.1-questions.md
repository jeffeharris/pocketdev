# Shelltender v0.4.1 Implementation Questions

<!-- Document Metadata
Created: 2025-07-11
Modified: 2025-07-11
Status: ????
-->


## Context
We're upgrading from v0.3.0 to v0.4.1 to fix terminal focus and resize issues. The v0.4.0 release notes mentioned "Ref-based API for manual control (fit method)" and you confirmed v0.4.1 adds focus() method. However, we're having trouble implementing this.

## Current Implementation Attempt

```typescript
import { Terminal, TerminalHandle, WebSocketProvider } from '@shelltender/client';

const DirectTerminalComponent = forwardRef<DirectTerminalHandle, DirectTerminalProps>(({ 
  taskId, 
  sessionId,
  className = '',
  worktreePath,
  isVisible = true
}, ref) => {
  const terminalRef = useRef<TerminalHandle>(null);

  // Trying to expose focus/fit methods
  useImperativeHandle(ref, () => ({
    focus: () => {
      console.log('[DirectTerminal] Focus called');
      terminalRef.current?.focus();  // <-- terminalRef.current is always null
    },
    fit: () => {
      console.log('[DirectTerminal] Fit called');
      terminalRef.current?.fit();     // <-- terminalRef.current is always null
    }
  }), [taskId]);

  return (
    <WebSocketProvider config={{ url: websocketUrl }}>
      <Terminal
        ref={terminalRef}  // <-- Is this correct usage?
        sessionId={terminalSessionId}
        onSessionCreated={(newSessionId: string) => {
          console.log('[DirectTerminal] Session created:', newSessionId);
          // terminalRef.current is still null here
          setTimeout(() => {
            terminalRef.current?.focus(); // Still null after delay
          }, 100);
        }}
      />
    </WebSocketProvider>
  );
});
```

## Questions

### 1. Terminal Ref API in v0.4.1

**Question:** Does the `<Terminal>` component in v0.4.1 properly forward refs and expose focus() and fit() methods?

We're trying to use:
```typescript
const terminalRef = useRef<TerminalHandle>(null);
<Terminal ref={terminalRef} ... />
// Later: terminalRef.current?.focus()
```

But `terminalRef.current` appears to be null. Is there a different API for programmatic focus/fit in v0.4.1?

### 2. Auto-resize Behavior

**Question:** Does v0.4.1 include automatic resize handling when the container size changes, or do we need to manually call fit() after container resize?

Currently seeing no resize logs, suggesting the terminal might not be detecting container size changes.

### 3. Focus Timing

**Question:** Is there a specific lifecycle event or callback we should use to know when the terminal is ready to accept focus?

We're currently trying to focus after `onSessionCreated`, but the ref still isn't available. Should we use a different callback or event?

### 4. TypeScript Types

**Question:** What methods does the `TerminalHandle` type actually expose in v0.4.1? 

We see the type is exported:
```typescript
import { TerminalHandle } from '@shelltender/client';
```

But when we try to use it, the expected methods (focus(), fit()) don't seem to be available. Could you provide the actual interface definition?

### 5. Alternative Focus API?

**Question:** If ref forwarding isn't fully supported yet, is there an alternative API for programmatic focus, such as:
- A `focus` prop on the Terminal component?
- An imperative API through the WebSocketProvider?
- A different component that wraps Terminal with these features?
- A method on the session object?

### 6. Working Example

**Request:** Could you provide a minimal working example showing the correct way to:
1. Get a ref to the Terminal
2. Call focus() when switching between terminals
3. Call fit() when the container resizes

## Our Use Case

We're managing multiple terminal sessions in a tabbed interface where:
- Users switch between tasks (each task has its own terminal session)
- When switching tasks, we need to focus the terminal so users can immediately type
- When the window resizes, terminals need to adjust their dimensions
- We keep all terminals mounted but hide inactive ones with `display: none`

## Environment
- @shelltender/client: ^0.4.1
- React: 19.1.0
- TypeScript: 5.8.3
- Running in Vite dev server with WebSocket proxy

Any guidance on the correct API usage would be greatly appreciated!