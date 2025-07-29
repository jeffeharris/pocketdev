# Keyboard Shortcuts Design Principles

## Overview

This document outlines the design principles for keyboard shortcuts in PocketDev, with special attention to terminal interaction and avoiding conflicts.

## The Terminal Challenge

PocketDev is unique because users spend 90% of their time with a terminal focused. When xterm.js has focus, it captures ALL keyboard input to pass to the shell/AI. This creates significant design constraints.

## Shortcut Precedence Hierarchy

Understanding what can capture keyboard events is crucial:

1. **Operating System** - Always wins
   - Alt+Tab (Windows/Linux), Cmd+Tab (Mac)
   - Cmd+Space (Mac Spotlight)
   - Windows key combinations
   - Cannot be overridden by web apps

2. **Browser** - Takes priority over web apps
   - Ctrl+T: New tab
   - Ctrl+W: Close tab
   - Ctrl+L: Address bar
   - F5/Ctrl+R: Refresh
   - Can sometimes be overridden with preventDefault()

3. **Web Application** - Our level
   - Can only capture what OS/Browser don't claim
   - Must compete with terminal for remaining keys

4. **Terminal (xterm.js)** - When focused
   - Captures everything the web app receives
   - Needs many shortcuts for shell functionality

## Design Principles by Context

### 1. Terminal Visible Context

When a terminal is visible and could be focused (most of PocketDev):

#### Use Alt for Single Keys
```typescript
'terminal.tab.1': { key: 'alt+1' }  // Switch to tab 1
'terminal.tab.new': { key: 'alt+t' }  // New tab
'terminal.tab.close': { key: 'alt+w' }  // Close tab
```

**Why Alt?**
- Rarely used by shells for critical functions
- Not commonly bound in terminal applications
- Easy to press with one hand
- Consistent mental model: "Alt = terminal shortcuts"

#### Use Ctrl+Shift for Complex Actions
```typescript
'terminal.split.toggle': { key: 'ctrl+shift+s' }
'terminal.search': { key: 'ctrl+shift+f' }
```

**Why Ctrl+Shift?**
- Adding Shift avoids most shell conflicts
- Still feels familiar to users
- Good for less frequent actions

#### Never Use Plain Ctrl+[key]
The shell/terminal needs these:
- **Ctrl+C**: Interrupt running process (CRITICAL)
- **Ctrl+D**: End of file signal
- **Ctrl+Z**: Suspend process
- **Ctrl+W**: Delete word backward
- **Ctrl+U**: Delete to beginning of line
- **Ctrl+K**: Delete to end of line
- **Ctrl+R**: Reverse history search
- **Ctrl+T**: Transpose characters
- **Ctrl+A/E**: Beginning/end of line

#### Avoid Escape
- **ESC**: Meta key prefix in shells (ESC+b = Alt+b)
- **ESC ESC**: Command history search
- **ESC .**: Insert last argument
- Vi-mode shells use ESC constantly

### 2. Non-Terminal Contexts

When terminal is NOT visible (modals, dialogs, diff viewer):

#### Can Use Simple Keys
```typescript
// In diff viewer modal
'diff.view.toggle': { key: 'v' }  // No modifier needed
'diff.search': { key: 's' }
'diff.next': { key: 'n' }
'diff.close': { key: 'escape' }

// In task list (no terminal visible)
'task.down': { key: 'j' }  // Vim-style navigation
'task.up': { key: 'k' }
```

#### Can Use Ctrl Without Shift
```typescript
'commit.submit': { key: 'ctrl+enter' }
'search.focus': { key: 'ctrl+f' }
```

### 3. Global Shortcuts

Must work everywhere without conflicts:

```typescript
'global.help': { key: 'f1' }  // F-keys are generally safe
'global.shortcuts': { key: 'shift+?' }  // Show shortcuts dialog
```

## Implementation Patterns

### Context Detection

```typescript
// Helper to determine if terminal is visible
export function isTerminalContext(): boolean {
  // Terminal is visible in task workspace
  return window.location.pathname.includes('/task/') ||
         window.location.pathname.includes('/terminal/');
}

// Dynamic key selection based on context
const saveShortcut = {
  key: isTerminalContext() ? 'ctrl+shift+s' : 'ctrl+s',
  handler: () => saveCurrentWork()
};
```

### Terminal Safety Check

```typescript
// Before registering a shortcut, verify it's terminal-safe
function isTerminalSafe(key: string): boolean {
  const unsafePatterns = [
    /^ctrl\+[a-z]$/,  // Plain Ctrl+letter
    /^escape$/,       // Plain escape
    /^ctrl\+\[$/,     // Ctrl+[ (also escape)
  ];
  
  return !unsafePatterns.some(pattern => pattern.test(key));
}
```

## User Communication

### Visual Indicators

1. **Tooltips**: Always show keyboard shortcuts in tooltips
   ```html
   <button title="New Terminal Tab (Alt+T)">
   ```

2. **Menu Items**: Display shortcuts next to actions
   ```
   File > New Tab          Alt+T
   View > Split Terminal   Ctrl+Shift+S
   ```

3. **Help Dialog**: F1 shows all available shortcuts with current context

### Documentation

1. **Onboarding**: Explain that Alt is the "terminal modifier"
2. **Help Text**: "When working in terminals, use Alt+[number] to switch tabs"
3. **Consistency**: Always use Alt for terminal actions

## Common Patterns

### Tab Navigation (Terminal Context)
- Alt+1 through Alt+6: Direct tab access
- Ctrl+Tab: Next tab
- Ctrl+Shift+Tab: Previous tab
- Alt+T: New tab
- Alt+W: Close tab

### Window/Pane Management
- Ctrl+Shift+S: Toggle split
- Ctrl+Shift+D: Change split direction
- Ctrl+Shift+Arrow: Navigate panes

### Universal Actions
- F1: Help
- Ctrl+K: Command palette (if not in terminal input)
- Shift+?: Show keyboard shortcuts

## Testing Guidelines

1. **Always test with active terminal**: Ensure shortcuts work when terminal has focus
2. **Test shell modes**: Verify in both regular and vi-mode shells
3. **Cross-platform testing**: Mac (Cmd), Windows/Linux (Ctrl)
4. **Conflict detection**: Verify no interference with common CLI tools

## Future Considerations

1. **Customization**: Allow users to rebind shortcuts
2. **Profiles**: Different shortcut sets for different workflows
3. **Learning Mode**: Progressive disclosure of shortcuts
4. **Conflict Resolution**: Warn when user shortcuts conflict with terminal

## Summary

The key insight is that PocketDev is fundamentally a terminal-first application. Our keyboard shortcuts must respect this by:

1. Using Alt as the primary modifier for terminal contexts
2. Avoiding conflicts with shell keybindings
3. Providing clear visual indicators
4. Maintaining consistency across the application

Remember: **When in doubt, use Alt for terminal shortcuts!**