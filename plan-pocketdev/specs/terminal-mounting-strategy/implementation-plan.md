# Terminal Mounting Strategy Implementation Plan (Simplified)

<!-- Document Metadata
Created: 2025-07-31
Modified: 2025-07-31
Status: ????
-->


## Overview
Simple implementation to keep terminals mounted using CSS visibility control.

## Context
**Problem**: When switching between tab/split/quad layouts in PocketDev, terminals disconnect and reconnect, causing a poor user experience.

**Solution**: Instead of conditionally rendering terminals (which unmounts them), render all terminals and use CSS `display: none` to hide inactive ones.

**Files to modify**:
- `frontend/src/components/terminal/TerminalPanel.tsx` (main changes)
- `frontend/src/components/terminal/TerminalPanel.css` (new file)
- `frontend/src/components/terminal/SplitViewContainer.tsx` (minor cleanup)

## Current Code to Replace
Look for this block in TerminalPanel.tsx around line 945-985:
```tsx
{layout.mode === 'split' || layout.mode === 'split-4' ? (
  <SplitViewContainer ... />
) : (
  // Tab mode - show single terminal
  (() => {
    const activeTerminal = terminals.find(t => t.dbSessionId === activeTabId);
    if (!activeTerminal) return null;
    return <DirectTerminal ... />;
  })()
)}
```

## Implementation Tasks

### Task 1: Add Terminal Container (Supports: REQ-TMS-001, REQ-TMS-002)
**File**: `frontend/src/components/terminal/TerminalPanel.tsx`
**Time**: 30 minutes

First, add the CSS import at the top of the file:
```tsx
import './TerminalPanel.css';
```

Then replace the conditional rendering block (shown in "Current Code to Replace" above) with:
```tsx
<div className={`terminals-container mode-${layout.mode}`}>
  {terminals.map(terminal => (
    <DirectTerminal
      key={terminal.dbSessionId}
      className={getTerminalClassName(terminal, layout)}
      style={{ 
        display: shouldShowTerminal(terminal, layout, activeTabId) ? 'block' : 'none',
        position: layout.mode === 'tab' ? 'absolute' : 'relative',
        width: '100%',
        height: '100%'
      }}
      ref={(el) => {
        if (el) {
          terminalRefs.current.set(terminal.dbSessionId, el);
        } else {
          terminalRefs.current.delete(terminal.dbSessionId);
        }
      }}
      taskId={task.id}
      dbSessionId={terminal.dbSessionId}
      shelltenderSessionId={terminal.shelltenderSessionId || terminal.sessionId}
      worktreePath={task.worktree_path}
      isVisible={shouldShowTerminal(terminal, layout, activeTabId) && isVisible}
      hasFocus={focusedTerminalId === terminal.dbSessionId}
      onSessionStatus={(status) => handleSessionStatus(terminal.dbSessionId, status)}
      onFocusRequest={() => setFocusedTerminal(task.id, terminal.dbSessionId)}
    />
  ))}
</div>
```

### Task 2: Implement Visibility Logic (Supports: REQ-TMS-003, REQ-TMS-005, REQ-TMS-006)
**File**: `frontend/src/components/terminal/TerminalPanel.tsx`
**Time**: 20 minutes

Add before the component return:
```tsx
const shouldShowTerminal = (
  terminal: TerminalSession, 
  layout: SplitLayoutConfig, 
  activeTabId: string
): boolean => {
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
};

const getTerminalClassName = (
  terminal: TerminalSession, 
  layout: SplitLayoutConfig
): string => {
  if (layout.mode === 'tab') return 'terminal terminal-tab';
  
  // Assign grid positions for split modes
  if (terminal.dbSessionId === layout.primaryTerminalId) return 'terminal terminal-primary';
  if (terminal.dbSessionId === layout.secondaryTerminalId) return 'terminal terminal-secondary';
  if (terminal.dbSessionId === layout.tertiaryTerminalId) return 'terminal terminal-tertiary';
  if (terminal.dbSessionId === layout.quaternaryTerminalId) return 'terminal terminal-quaternary';
  
  return 'terminal terminal-hidden';
};
```

### Task 3: Add Container Styles (Supports: REQ-TMS-002, REQ-TMS-004)
**File**: `frontend/src/components/terminal/TerminalPanel.css` (create if needed)
**Time**: 20 minutes

```css
.terminals-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #1f2937;
}

/* Tab mode - stack all terminals */
.terminals-container.mode-tab {
  position: relative;
}

.terminals-container.mode-tab .terminal {
  position: absolute !important;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* Split mode - 2x1 grid */
.terminals-container.mode-split {
  display: grid;
  gap: 1px;
}

.terminals-container.mode-split.orientation-vertical {
  grid-template-columns: 1fr 1fr;
  grid-template-areas: "primary secondary";
}

.terminals-container.mode-split.orientation-horizontal {
  grid-template-rows: 1fr 1fr;
  grid-template-areas: 
    "primary"
    "secondary";
}

/* Quad mode - 2x2 grid */
.terminals-container.mode-split-4 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  grid-template-areas: 
    "primary secondary"
    "tertiary quaternary";
  gap: 1px;
}

/* Terminal positioning */
.terminal-primary { grid-area: primary; }
.terminal-secondary { grid-area: secondary; }
.terminal-tertiary { grid-area: tertiary; }
.terminal-quaternary { grid-area: quaternary; }

/* Hidden terminals - keep mounted but off-screen */
.terminal-hidden {
  position: absolute !important;
  left: -9999px !important;
  pointer-events: none;
}
```

### Task 4: Update Split Container Integration (Supports: REQ-TMS-001)
**File**: `frontend/src/components/terminal/TerminalPanel.tsx`
**Time**: 30 minutes

Since we're rendering all terminals now, we need to update how split view works:
1. Remove the split view terminal rendering from SplitViewContainer
2. Keep only the layout controls and divider in SplitViewContainer
3. Pass layout orientation as a class to terminals-container

### Task 5: Clean Up Old Code (Supports: REQ-TMS-004)
**Time**: 20 minutes

Remove:
- The conditional rendering between SplitViewContainer and DirectTerminal
- The terminal rendering logic from SplitViewContainer (keep layout controls)
- Any unused imports

### Task 6: Testing (Validates all requirements)
**Time**: 30 minutes

Test scenarios:
1. Switch from tab to split mode - terminals stay connected
2. Switch from split to quad mode - no reconnections
3. Switch back to tab mode - only active terminal visible
4. Create new terminal - appears in correct position
5. Check browser DevTools - verify all terminals remain in DOM

## Total Time Estimate
~2.5 hours for implementation and testing

## Success Validation
- [ ] Terminal connections persist through all layout changes (REQ-TMS-001)
- [ ] CSS display property controls visibility (REQ-TMS-002)
- [ ] No component remounting on layout switch (REQ-TMS-003)
- [ ] Implementation under 200 lines changed (REQ-TMS-004)
- [ ] Tab mode shows single terminal (REQ-TMS-005)
- [ ] Split modes show correct terminals (REQ-TMS-006)

## Important Notes for Implementation

1. **Keep SplitViewContainer** - Don't delete it! We still need it for:
   - Split ratio resizing
   - Terminal assignment dropdowns
   - Layout controls
   
2. **Test as you go** - After each task, verify terminals stay connected when switching layouts

3. **CSS Grid Layouts** - The grid areas handle the visual positioning automatically

4. **isVisible prop** - DirectTerminal already supports this prop, we're just using it properly now

## Rollback Plan
If issues arise, revert the single commit since all changes are localized to TerminalPanel.

## Expected Outcome
After implementation:
- Switch from tab to split mode → No connection drop, terminals instantly appear in split positions
- Switch from split to quad → No flicker, smooth transition
- All terminals stay connected in background, ready to display instantly