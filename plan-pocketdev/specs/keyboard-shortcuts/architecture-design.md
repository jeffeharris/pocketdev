# Keyboard Shortcuts Architecture Design

## Overview

This document outlines a centralized, context-aware keyboard shortcut system for PocketDev that provides:
- Single source of truth for all shortcuts
- Context-based activation (only relevant shortcuts active)
- No conflicts between shortcuts
- Easy discoverability and documentation
- Testable and maintainable

## Architecture Options

### Option 1: React Context + Hook System (Recommended)

```typescript
// Core architecture
KeyboardProvider (React Context)
├── ShortcutRegistry (centralized definitions)
├── ContextManager (tracks active contexts)
├── KeyboardListener (global event handler)
└── Hooks (useKeyboardShortcut, useShortcutContext)
```

**Pros**:
- React-native solution
- Easy to test with React Testing Library
- Natural component integration
- TypeScript-friendly

**Cons**:
- Requires wrapping app in provider
- May have performance implications with many shortcuts

### Option 2: Event-Driven System

```typescript
// Event bus architecture
KeyboardManager (Singleton)
├── ShortcutRegistry
├── EventBus
├── ContextStack
└── PriorityQueue
```

**Pros**:
- Framework agnostic
- Could work outside React components
- More flexible for complex scenarios

**Cons**:
- More boilerplate
- Harder to integrate with React
- Testing requires more setup

### Option 3: Third-Party Library (react-hotkeys-hook)

**Pros**:
- Battle-tested
- Less code to maintain
- Good documentation

**Cons**:
- External dependency
- May not fit all needs
- Less control over implementation

## Recommended Implementation (Option 1)

### 1. Core Types and Registry

```typescript
// types/keyboard.ts
export interface KeyboardShortcut {
  id: string;
  key: string; // e.g., "ctrl+shift+s"
  description: string;
  category: 'global' | 'terminal' | 'editor' | 'navigation';
  contexts: ShortcutContext[];
  handler: (event: KeyboardEvent) => void | boolean;
  enabled?: boolean;
  preventDefault?: boolean;
}

export interface ShortcutContext {
  name: string;
  priority: number; // Higher priority contexts override lower
  test?: () => boolean; // Dynamic context check
}

// Centralized registry
export const KEYBOARD_SHORTCUTS: Record<string, KeyboardShortcut> = {
  // Global shortcuts (always active)
  'global.help': {
    id: 'global.help',
    key: 'f1',
    description: 'Show keyboard shortcuts help',
    category: 'global',
    contexts: [{ name: 'global', priority: 0 }],
    handler: () => showShortcutsDialog()
  },
  
  // Terminal shortcuts (only in terminal context)
  'terminal.splitView.toggle': {
    id: 'terminal.splitView.toggle',
    key: 'ctrl+shift+s',
    description: 'Toggle split view mode',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => toggleSplitView()
  },
  
  'terminal.splitView.orientation': {
    id: 'terminal.splitView.orientation',
    key: 'ctrl+shift+d',
    description: 'Toggle split orientation',
    category: 'terminal',
    contexts: [
      { 
        name: 'terminal', 
        priority: 10,
        test: () => useSplitViewStore.getState().mode === 'split'
      }
    ],
    handler: () => toggleOrientation()
  },
  
  'terminal.navigate.left': {
    id: 'terminal.navigate.left',
    key: 'ctrl+shift+arrowleft',
    description: 'Focus left terminal pane',
    category: 'terminal',
    contexts: [
      { 
        name: 'splitView', 
        priority: 20,
        test: () => isInSplitView()
      }
    ],
    handler: () => focusPane('left')
  },
  
  // Editor shortcuts (future)
  'editor.save': {
    id: 'editor.save',
    key: 'ctrl+s',
    description: 'Save current file',
    category: 'editor',
    contexts: [{ name: 'editor', priority: 15 }],
    handler: () => saveCurrentFile()
  }
};
```

### 2. Context Provider Implementation

```typescript
// contexts/KeyboardContext.tsx
interface KeyboardContextValue {
  registerShortcut: (shortcut: KeyboardShortcut) => void;
  unregisterShortcut: (id: string) => void;
  pushContext: (context: string) => void;
  popContext: (context: string) => void;
  isShortcutActive: (id: string) => boolean;
  getActiveShortcuts: () => KeyboardShortcut[];
}

export const KeyboardProvider: React.FC = ({ children }) => {
  const [activeContexts, setActiveContexts] = useState<Set<string>>(
    new Set(['global'])
  );
  const [shortcuts] = useState(() => new Map(
    Object.entries(KEYBOARD_SHORTCUTS)
  ));

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = formatKeyCombo(event);
      const activeShortcuts = getActiveShortcuts();
      
      // Find matching shortcut with highest priority
      const matches = activeShortcuts
        .filter(s => s.key === key)
        .sort((a, b) => {
          const aPriority = Math.max(...a.contexts.map(c => c.priority));
          const bPriority = Math.max(...b.contexts.map(c => c.priority));
          return bPriority - aPriority;
        });

      if (matches.length > 0) {
        const shortcut = matches[0];
        
        // Check dynamic context tests
        const passesTests = shortcut.contexts.every(
          ctx => !ctx.test || ctx.test()
        );
        
        if (passesTests) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          
          const handled = shortcut.handler(event);
          if (handled === false) {
            // Allow event to propagate
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeContexts, shortcuts]);

  const getActiveShortcuts = useCallback(() => {
    return Array.from(shortcuts.values()).filter(shortcut => {
      // Check if any context is active
      return shortcut.contexts.some(ctx => 
        activeContexts.has(ctx.name) && 
        (!ctx.test || ctx.test())
      );
    });
  }, [activeContexts, shortcuts]);

  // ... rest of implementation
};
```

### 3. Hook Usage

```typescript
// hooks/useKeyboardShortcut.ts
export function useKeyboardShortcut(
  key: string,
  handler: (event: KeyboardEvent) => void,
  options: {
    contexts?: string[];
    enabled?: boolean;
    preventDefault?: boolean;
    description?: string;
  } = {}
) {
  const { registerShortcut, unregisterShortcut } = useKeyboard();
  
  useEffect(() => {
    if (!options.enabled ?? true) return;
    
    const shortcut: KeyboardShortcut = {
      id: `dynamic-${key}-${Math.random()}`,
      key,
      handler,
      description: options.description || `Dynamic shortcut: ${key}`,
      category: 'dynamic',
      contexts: (options.contexts || ['global']).map(name => ({
        name,
        priority: 10
      })),
      preventDefault: options.preventDefault
    };
    
    registerShortcut(shortcut);
    return () => unregisterShortcut(shortcut.id);
  }, [key, handler, options]);
}

// hooks/useShortcutContext.ts
export function useShortcutContext(context: string) {
  const { pushContext, popContext } = useKeyboard();
  
  useEffect(() => {
    pushContext(context);
    return () => popContext(context);
  }, [context]);
}
```

### 4. Component Integration

```typescript
// Example: Terminal component with shortcuts
function TerminalPanel({ taskId }: Props) {
  // Activate terminal context when component mounts
  useShortcutContext('terminal');
  
  // Register component-specific shortcuts
  useKeyboardShortcut('ctrl+c', () => {
    copySelectedText();
  }, {
    contexts: ['terminal'],
    description: 'Copy selected text'
  });
  
  // Conditionally activate split view context
  const splitMode = useSplitMode(taskId);
  useShortcutContext(splitMode === 'split' ? 'splitView' : '');
  
  return <div>...</div>;
}

// Example: Focus-aware shortcuts
function SplitViewContainer({ taskId }: Props) {
  const [focusedPane, setFocusedPane] = useState<'primary' | 'secondary'>('primary');
  
  useKeyboardShortcut('ctrl+shift+arrowleft', () => {
    if (focusedPane === 'secondary') {
      setFocusedPane('primary');
      focusPrimaryTerminal();
    }
  }, {
    contexts: ['splitView'],
    enabled: focusedPane === 'secondary'
  });
  
  return <div>...</div>;
}
```

### 5. Shortcut Discovery UI

```typescript
// components/KeyboardShortcutsDialog.tsx
export function KeyboardShortcutsDialog() {
  const { getActiveShortcuts } = useKeyboard();
  const shortcuts = getActiveShortcuts();
  
  // Group by category
  const grouped = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);
  
  return (
    <Dialog>
      <h2>Keyboard Shortcuts</h2>
      {Object.entries(grouped).map(([category, shortcuts]) => (
        <div key={category}>
          <h3>{category}</h3>
          <table>
            {shortcuts.map(shortcut => (
              <tr key={shortcut.id}>
                <td><Kbd>{shortcut.key}</Kbd></td>
                <td>{shortcut.description}</td>
              </tr>
            ))}
          </table>
        </div>
      ))}
    </Dialog>
  );
}
```

### 6. Testing Strategy

```typescript
// __tests__/keyboard.test.tsx
describe('Keyboard Shortcuts', () => {
  it('executes shortcut in correct context', () => {
    const handler = vi.fn();
    
    renderWithKeyboard(
      <TestComponent onShortcut={handler} context="terminal" />
    );
    
    fireEvent.keyDown(window, {
      key: 'S',
      ctrlKey: true,
      shiftKey: true
    });
    
    expect(handler).toHaveBeenCalled();
  });
  
  it('ignores shortcut in wrong context', () => {
    const handler = vi.fn();
    
    renderWithKeyboard(
      <TestComponent onShortcut={handler} context="editor" />
    );
    
    fireEvent.keyDown(window, {
      key: 'S',
      ctrlKey: true,
      shiftKey: true
    });
    
    expect(handler).not.toHaveBeenCalled();
  });
  
  it('respects priority when shortcuts conflict', () => {
    const lowPriorityHandler = vi.fn();
    const highPriorityHandler = vi.fn();
    
    // Register same key in different contexts
    // Terminal context has priority 10
    // Editor context has priority 15
    
    expect(highPriorityHandler).toHaveBeenCalled();
    expect(lowPriorityHandler).not.toHaveBeenCalled();
  });
});
```

## Implementation Plan

### Phase 1: Core Infrastructure
1. Create types and registry
2. Implement KeyboardProvider
3. Create basic hooks
4. Add to App.tsx

### Phase 2: Terminal Shortcuts
1. Define all terminal shortcuts in registry
2. Add context activation to TerminalPanel
3. Implement split view navigation
4. Add tests

### Phase 3: Discovery & Documentation
1. Create shortcuts dialog
2. Add help menu item
3. Document all shortcuts
4. Add to user guide

### Phase 4: Advanced Features
1. Customizable shortcuts
2. Shortcut recording
3. Conflict detection
4. Import/export settings

## Design Principles

### Keyboard Shortcut Precedence
Understanding the precedence hierarchy is crucial for avoiding conflicts:

1. **OS Level** - Always wins (e.g., Alt+Tab, Cmd+Space)
2. **Browser Level** - Takes most unmodified shortcuts (e.g., Ctrl+T for new tab)
3. **Web App Level** - Can only capture what OS/Browser don't claim
4. **Terminal Level** - When focused, xterm.js captures everything the web app receives

### Context-Based Key Selection

1. **Terminal Visible Context**
   - **Use Alt+[key]** for single key shortcuts (Alt+1, Alt+T)
   - **Use Ctrl+Shift+[key]** for actions that might conflict
   - **Never use plain Ctrl+[key]** - terminals need these for:
     - Ctrl+C: Interrupt process
     - Ctrl+D: EOF signal
     - Ctrl+W: Delete word backward
     - Ctrl+T: Transpose characters
     - Ctrl+R: Reverse search
   - **Avoid Escape** - heavily used for Meta key prefix in shells

2. **Non-Terminal Contexts** (modals, diff viewer, etc.)
   - Can use simple keys without modifiers (v, s, escape)
   - Can use Ctrl+[key] safely
   - More freedom since no terminal interference

3. **Global Shortcuts**
   - Must work everywhere without conflicts
   - F-keys are generally safe (F1 for help)
   - Ctrl+K for command palette (check terminal context)

### Examples by Context

```typescript
// TERMINAL VISIBLE - Use Alt or Ctrl+Shift
'terminal.tab.1': { key: 'alt+1' }
'terminal.tab.new': { key: 'alt+t' }
'terminal.split.toggle': { key: 'ctrl+shift+s' }

// DIFF VIEWER (Modal) - Simple keys OK
'diff.view.toggle': { key: 'v' }
'diff.search': { key: 's' }
'diff.close': { key: 'escape' }

// GLOBAL - Always available
'global.help': { key: 'f1' }
```

## Best Practices

1. **Context Naming**: Use hierarchical names (e.g., `terminal.splitView`)
2. **Priority Guidelines**:
   - Global: 0-9
   - Feature-level: 10-19
   - Component-level: 20-29
   - Modal/Dialog: 30+

3. **Key Format**: Always lowercase, modifiers first (`ctrl+shift+s`)
4. **Testing**: Test context switches and priority conflicts
5. **Documentation**: Keep KEYBOARD_SHORTCUTS as source of truth
6. **Terminal Safety**: Always test shortcuts with active terminal sessions
7. **User Education**: Clearly document that Alt is the terminal modifier

## Migration Strategy

1. Start with new features (split view shortcuts)
2. Gradually migrate existing shortcuts
3. Remove old event listeners
4. Update documentation

## Performance Considerations

1. Use key string matching (fast) vs parsing
2. Memoize active shortcuts list
3. Debounce rapid context changes
4. Lazy load shortcut handlers

## Accessibility

1. Provide alternative access methods
2. Announce shortcut actions to screen readers
3. Allow disabling shortcuts
4. Support customization for accessibility needs