# BUG-015: Extract TerminalPanel into Deep Modules

<!-- Document Metadata
Created: 2025-08-01
Modified: 2025-08-01
Status: ????
-->


## Summary
TerminalPanel.tsx is a 1087-line React component managing 10+ different concerns, violating Ousterhout's deep module principle. It has become a "god component" with excessive responsibilities.

## Current State
- **File**: `/frontend/src/components/terminal/TerminalPanel.tsx`
- **Lines**: 1087
- **State variables**: 20+
- **Responsibilities**: Terminal rendering, tab management, session launching, split views, keyboard shortcuts, connection status, AI agent launching

## Problems Identified
1. **Shallow module**: Complex interface with 12+ props
2. **Mixed concerns**: Layout logic mixed with session management
3. **State synchronization**: Multiple sources of truth (localStorage, sessionStorage, component state, stores)
4. **Cognitive overload**: Understanding any feature requires understanding entire component

## Code Examples
```typescript
// Current: Everything in one component
const TerminalPanel = (props: TerminalPanelProps) => {
  // 20+ state variables
  const [activeTabId, setActiveTabId] = useState(...);
  const [showSessionLauncher, setShowSessionLauncher] = useState(...);
  const [sessionStatuses, setSessionStatuses] = useState(...);
  const [launchingClaude, setLaunchingClaude] = useState(...);
  const [confirmClose, setConfirmClose] = useState(...);
  const [canShowQuad, setCanShowQuad] = useState(...);
  // ... many more
  
  // 100+ lines of viewport calculations
  // 120+ lines of keyboard handling
  // Session management logic
  // Split view logic
  // Tab management
  // ... etc
};
```

## Proposed Solution
Decompose into focused, deep modules:

```typescript
// Deep modules with simple interfaces
<TerminalWorkspace>
  <TerminalLayoutProvider>
    <TerminalTabBar />
    <TerminalViewport>
      <TerminalSessionProvider>
        <TerminalInstance />
      </TerminalSessionProvider>
    </TerminalViewport>
  </TerminalLayoutProvider>
</TerminalWorkspace>

// Each module hides complexity
const useTerminalSessions = () => {
  // All session management logic hidden here
  return {
    sessions: [],
    activeSession: null,
    createSession: () => {},
    closeSession: () => {}
  };
};

const useViewportConstraints = () => {
  // Complex viewport calculations hidden
  return { canSplit: true, canQuad: false, maxLayout: 'split' };
};
```

## Implementation Steps
1. Extract hooks:
   - `useTerminalSessions` - Session state management
   - `useViewportConstraints` - Layout calculations
   - `useTerminalKeyboard` - Keyboard handling
2. Create components:
   - `TerminalLayoutManager` - Split view logic
   - `TerminalTabBar` - Tab management
   - `SessionLauncher` - Already exists, needs enhancement
   - `ConnectionStatusManager` - Connection handling
3. Create services:
   - `AIAgentFactory` - Agent command construction
   - `TerminalStateStore` - Centralized state management
4. Remove localStorage/sessionStorage from component
5. Implement proper component composition

## Benefits
- **Deep modules**: Each module hides significant complexity
- **Single responsibility**: Each component has one clear purpose
- **Testability**: Can test each module in isolation
- **Maintainability**: Changes isolated to relevant modules
- **Performance**: Better re-render optimization

## Priority: High
This component is central to the user experience and its complexity makes it a high-risk area for bugs.

## Estimated Effort: 3-4 days

## Filed: 2025-08-01