# Terminal Mounting Strategy Technical Design (Simplified)

<!-- Document Metadata
Created: 2025-07-31
Modified: 2025-07-31
Status: ????
-->


## Overview
Use CSS display property to show/hide terminals instead of conditional rendering, keeping all terminals mounted.

## Current Problem
```tsx
// Current: Terminals unmount when switching layouts
{layout.mode === 'split' ? <SplitViewContainer /> : <DirectTerminal />}
```

## Proposed Solution

### Core Change
Render all terminals always, control visibility with CSS:

```tsx
// New: All terminals rendered, CSS controls visibility
<div className="terminals-container">
  {terminals.map(terminal => (
    <DirectTerminal
      key={terminal.dbSessionId}
      style={{ display: shouldShowTerminal(terminal, layout) ? 'block' : 'none' }}
      {...terminalProps}
    />
  ))}
</div>
```

### Implementation Details

#### 1. Update TerminalPanel
- Remove conditional rendering between tab/split modes
- Render all terminals in a container
- Add `shouldShowTerminal` logic

#### 2. Visibility Logic
```tsx
function shouldShowTerminal(terminal: TerminalSession, layout: SplitLayoutConfig): boolean {
  switch (layout.mode) {
    case 'tab':
      return terminal.dbSessionId === activeTabId;
    case 'split':
      return terminal.dbSessionId === layout.primaryTerminalId ||
             terminal.dbSessionId === layout.secondaryTerminalId;
    case 'split-4':
      return terminal.dbSessionId === layout.primaryTerminalId ||
             terminal.dbSessionId === layout.secondaryTerminalId ||
             terminal.dbSessionId === layout.tertiaryTerminalId ||
             terminal.dbSessionId === layout.quaternaryTerminalId;
    default:
      return false;
  }
}
```

#### 3. Container Styling
Use CSS Grid for split layouts:
```css
.terminals-container {
  width: 100%;
  height: 100%;
  position: relative;
}

/* Tab mode - stack terminals */
.terminals-container.mode-tab .terminal {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* Split mode - grid layout */
.terminals-container.mode-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
}

/* Hidden terminals positioned off-screen */
.terminal[style*="display: none"] {
  position: absolute;
  left: -9999px;
}
```

## Key Benefits
1. **Minimal changes** - Mostly CSS and display logic
2. **No new components** - Reuse existing DirectTerminal
3. **Simple mental model** - All terminals exist, CSS controls visibility
4. **Easy to test** - Can verify with DevTools

## Migration Path
1. Add container div and map terminals
2. Implement shouldShowTerminal function  
3. Add CSS for layout modes
4. Remove old conditional rendering
5. Test all layout transitions

## Risks
- Hidden terminals still process output (minor performance impact)
- Need to ensure proper sizing when terminals become visible

## Success Metrics
- Zero connection drops on layout change
- < 200 lines of code changed
- No new components introduced