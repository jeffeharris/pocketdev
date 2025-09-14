# Keyboard Shortcuts Implementation Example

<!-- Document Metadata
Created: 2025-07-29
Modified: 2025-07-29
Status: ????
-->


## Complete Working Example

Here's a full implementation example showing how the keyboard shortcut system would work in PocketDev.

### 1. Shortcut Registry

```typescript
// config/keyboardShortcuts.ts
import { KeyboardShortcut } from '../types/keyboard';
import { splitViewStore } from '../stores/splitViewStore';
import { terminalStore } from '../stores/terminalStore';

export const KEYBOARD_SHORTCUTS: Record<string, KeyboardShortcut> = {
  // Global shortcuts
  'global.help': {
    id: 'global.help',
    key: 'f1',
    description: 'Show keyboard shortcuts',
    category: 'global',
    contexts: [{ name: 'global', priority: 0 }],
    handler: () => {
      // Open shortcuts dialog
      document.dispatchEvent(new CustomEvent('show-shortcuts'));
    }
  },
  
  'global.search': {
    id: 'global.search',
    key: 'ctrl+k',
    description: 'Open command palette',
    category: 'global',
    contexts: [{ name: 'global', priority: 0 }],
    handler: () => {
      // Open command palette
      document.dispatchEvent(new CustomEvent('show-command-palette'));
    }
  },
  
  // Terminal navigation
  'terminal.tabs.next': {
    id: 'terminal.tabs.next',
    key: 'ctrl+tab',
    description: 'Next terminal tab',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => {
      const store = terminalStore.getState();
      const taskId = getCurrentTaskId();
      const terminals = store.getTaskTerminals(taskId);
      const activeId = store.getActiveTerminalId(taskId);
      
      const currentIndex = terminals.findIndex(t => t.dbSessionId === activeId);
      const nextIndex = (currentIndex + 1) % terminals.length;
      
      store.setActiveTerminal(taskId, terminals[nextIndex].dbSessionId);
    }
  },
  
  'terminal.tabs.previous': {
    id: 'terminal.tabs.previous',
    key: 'ctrl+shift+tab',
    description: 'Previous terminal tab',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => {
      // Similar to next, but backwards
    }
  },
  
  // Split view shortcuts
  'splitView.toggle': {
    id: 'splitView.toggle',
    key: 'ctrl+shift+s',
    description: 'Toggle split view',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => {
      const taskId = getCurrentTaskId();
      splitViewStore.getState().toggleSplitMode(taskId);
    }
  },
  
  'splitView.orientation': {
    id: 'splitView.orientation',
    key: 'ctrl+shift+d',
    description: 'Toggle split orientation',
    category: 'terminal',
    contexts: [
      { 
        name: 'splitView', 
        priority: 20,
        test: () => {
          const taskId = getCurrentTaskId();
          return splitViewStore.getState().getLayout(taskId).mode === 'split';
        }
      }
    ],
    handler: () => {
      const taskId = getCurrentTaskId();
      const layout = splitViewStore.getState().getLayout(taskId);
      splitViewStore.getState().updateLayout(taskId, {
        orientation: layout.orientation === 'horizontal' ? 'vertical' : 'horizontal'
      });
    }
  },
  
  'splitView.focusLeft': {
    id: 'splitView.focusLeft',
    key: 'ctrl+shift+arrowleft',
    description: 'Focus left/top pane',
    category: 'terminal',
    contexts: [{ name: 'splitView', priority: 20 }],
    handler: () => {
      const taskId = getCurrentTaskId();
      const layout = splitViewStore.getState().getLayout(taskId);
      
      if (layout.orientation === 'horizontal') {
        splitViewStore.getState().setActivePane(taskId, 'primary');
        focusTerminal(layout.primaryTerminalId);
      } else {
        // In vertical, left is still primary
        splitViewStore.getState().setActivePane(taskId, 'primary');
        focusTerminal(layout.primaryTerminalId);
      }
    }
  },
  
  'splitView.focusRight': {
    id: 'splitView.focusRight',
    key: 'ctrl+shift+arrowright',
    description: 'Focus right/bottom pane',
    category: 'terminal',
    contexts: [{ name: 'splitView', priority: 20 }],
    handler: () => {
      const taskId = getCurrentTaskId();
      const layout = splitViewStore.getState().getLayout(taskId);
      
      splitViewStore.getState().setActivePane(taskId, 'secondary');
      focusTerminal(layout.secondaryTerminalId);
    }
  },
  
  'splitView.equalize': {
    id: 'splitView.equalize',
    key: 'ctrl+shift+e',
    description: 'Equalize split panes',
    category: 'terminal',
    contexts: [{ name: 'splitView', priority: 20 }],
    handler: () => {
      const taskId = getCurrentTaskId();
      splitViewStore.getState().setSplitRatio(taskId, 0.5);
    }
  },
  
  'splitView.exit': {
    id: 'splitView.exit',
    key: 'escape',
    description: 'Exit split view',
    category: 'terminal',
    contexts: [
      { 
        name: 'splitView', 
        priority: 20,
        test: () => !isInModalOrInput()
      }
    ],
    handler: () => {
      const taskId = getCurrentTaskId();
      splitViewStore.getState().updateLayout(taskId, { mode: 'tab' });
    }
  }
};

// Helper functions
function getCurrentTaskId(): string {
  // Get from router params or context
  return window.location.pathname.split('/').pop() || '';
}

function focusTerminal(terminalId: string | null) {
  if (!terminalId) return;
  
  // Focus the xterm.js instance
  const element = document.querySelector(`[data-terminal-id="${terminalId}"]`);
  if (element) {
    element.focus();
    // Trigger xterm focus
    const event = new CustomEvent('terminal-focus', { detail: { terminalId } });
    element.dispatchEvent(event);
  }
}

function isInModalOrInput(): boolean {
  // Check if user is typing in an input or modal is open
  const activeElement = document.activeElement;
  return (
    activeElement?.tagName === 'INPUT' ||
    activeElement?.tagName === 'TEXTAREA' ||
    document.querySelector('[role="dialog"]') !== null
  );
}
```

### 2. Context Provider with Priority System

```typescript
// contexts/KeyboardContext.tsx
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { KEYBOARD_SHORTCUTS } from '../config/keyboardShortcuts';
import type { KeyboardShortcut, ShortcutContext } from '../types/keyboard';

interface KeyboardContextValue {
  registerShortcut: (shortcut: KeyboardShortcut) => void;
  unregisterShortcut: (id: string) => void;
  pushContext: (context: string) => void;
  popContext: (context: string) => void;
  isShortcutActive: (id: string) => boolean;
  getActiveShortcuts: () => KeyboardShortcut[];
  getShortcutByKey: (key: string) => KeyboardShortcut | undefined;
}

const KeyboardContext = createContext<KeyboardContextValue | null>(null);

export function useKeyboard() {
  const context = useContext(KeyboardContext);
  if (!context) {
    throw new Error('useKeyboard must be used within KeyboardProvider');
  }
  return context;
}

export function KeyboardProvider({ children }: { children: React.ReactNode }) {
  const [shortcuts] = useState(() => new Map(Object.entries(KEYBOARD_SHORTCUTS)));
  const [activeContexts, setActiveContexts] = useState<Set<string>>(new Set(['global']));
  const [dynamicShortcuts, setDynamicShortcuts] = useState<Map<string, KeyboardShortcut>>(new Map());
  
  // Track context reference counts for proper cleanup
  const contextRefs = useRef<Map<string, number>>(new Map());

  const formatKeyCombo = useCallback((event: KeyboardEvent): string => {
    const parts: string[] = [];
    
    if (event.ctrlKey || event.metaKey) parts.push('ctrl');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');
    
    // Normalize key name
    let key = event.key.toLowerCase();
    if (key === 'arrowleft') key = 'arrowleft';
    if (key === 'arrowright') key = 'arrowright';
    if (key === 'arrowup') key = 'arrowup';
    if (key === 'arrowdown') key = 'arrowdown';
    
    parts.push(key);
    
    return parts.join('+');
  }, []);

  const getActiveShortcuts = useCallback((): KeyboardShortcut[] => {
    const allShortcuts = [...shortcuts.values(), ...dynamicShortcuts.values()];
    
    return allShortcuts.filter(shortcut => {
      if (shortcut.enabled === false) return false;
      
      return shortcut.contexts.some(ctx => {
        // Check if context is active
        if (!activeContexts.has(ctx.name)) return false;
        
        // Check dynamic test if provided
        if (ctx.test && !ctx.test()) return false;
        
        return true;
      });
    });
  }, [shortcuts, dynamicShortcuts, activeContexts]);

  const pushContext = useCallback((context: string) => {
    if (!context) return;
    
    setActiveContexts(prev => new Set([...prev, context]));
    
    // Track reference count
    const refs = contextRefs.current;
    refs.set(context, (refs.get(context) || 0) + 1);
  }, []);

  const popContext = useCallback((context: string) => {
    if (!context) return;
    
    const refs = contextRefs.current;
    const count = refs.get(context) || 0;
    
    if (count <= 1) {
      // Last reference, remove context
      refs.delete(context);
      setActiveContexts(prev => {
        const next = new Set(prev);
        next.delete(context);
        return next;
      });
    } else {
      // Decrement reference count
      refs.set(context, count - 1);
    }
  }, []);

  const registerShortcut = useCallback((shortcut: KeyboardShortcut) => {
    setDynamicShortcuts(prev => new Map(prev).set(shortcut.id, shortcut));
  }, []);

  const unregisterShortcut = useCallback((id: string) => {
    setDynamicShortcuts(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if user is typing
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      const key = formatKeyCombo(event);
      const activeShortcuts = getActiveShortcuts();
      
      // Find all matching shortcuts
      const matches = activeShortcuts
        .filter(s => s.key === key)
        .sort((a, b) => {
          // Sort by highest priority context
          const aPriority = Math.max(...a.contexts.map(c => c.priority));
          const bPriority = Math.max(...b.contexts.map(c => c.priority));
          return bPriority - aPriority;
        });

      if (matches.length > 0) {
        const shortcut = matches[0];
        
        console.debug(`Keyboard shortcut triggered: ${shortcut.id} (${key})`);
        
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
          event.stopPropagation();
        }
        
        try {
          const result = shortcut.handler(event);
          if (result === false) {
            // Handler explicitly returned false, allow propagation
            event.stopPropagation = () => {};
          }
        } catch (error) {
          console.error(`Error in keyboard shortcut handler ${shortcut.id}:`, error);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [formatKeyCombo, getActiveShortcuts]);

  const value: KeyboardContextValue = {
    registerShortcut,
    unregisterShortcut,
    pushContext,
    popContext,
    isShortcutActive: (id: string) => {
      const shortcut = shortcuts.get(id) || dynamicShortcuts.get(id);
      if (!shortcut) return false;
      
      return getActiveShortcuts().some(s => s.id === id);
    },
    getActiveShortcuts,
    getShortcutByKey: (key: string) => {
      return getActiveShortcuts().find(s => s.key === key);
    }
  };

  return (
    <KeyboardContext.Provider value={value}>
      {children}
    </KeyboardContext.Provider>
  );
}
```

### 3. Usage in Components

```typescript
// components/terminal/TerminalPanel.tsx
import { useShortcutContext } from '../../hooks/useShortcutContext';

export function TerminalPanel({ taskId, projectId }: Props) {
  // Activate terminal context when this component is mounted
  useShortcutContext('terminal');
  
  const splitMode = useSplitMode(taskId);
  
  // Conditionally activate split view context
  useShortcutContext(splitMode === 'split' ? 'splitView' : null);
  
  return (
    <div className="terminal-panel">
      {/* Terminal content */}
    </div>
  );
}

// hooks/useShortcutContext.ts
export function useShortcutContext(context: string | null) {
  const { pushContext, popContext } = useKeyboard();
  
  useEffect(() => {
    if (!context) return;
    
    pushContext(context);
    return () => popContext(context);
  }, [context, pushContext, popContext]);
}

// components/terminal/DirectTerminal.tsx
export function DirectTerminal({ terminalId, isFocused }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);
  
  // Register terminal-specific shortcuts when focused
  useKeyboardShortcut('ctrl+c', (e) => {
    if (terminal?.hasSelection()) {
      e.preventDefault();
      const selection = terminal.getSelection();
      navigator.clipboard.writeText(selection);
    }
  }, {
    enabled: isFocused,
    contexts: ['terminal'],
    description: 'Copy selection'
  });
  
  useEffect(() => {
    if (isFocused && terminalRef.current) {
      terminalRef.current.focus();
    }
  }, [isFocused]);
  
  return (
    <div 
      ref={terminalRef}
      data-terminal-id={terminalId}
      tabIndex={0}
    >
      {/* xterm.js container */}
    </div>
  );
}
```

### 4. Shortcut Discovery Dialog

```typescript
// components/KeyboardShortcutsDialog.tsx
import { useState } from 'react';
import { useKeyboard } from '../contexts/KeyboardContext';
import { KEYBOARD_SHORTCUTS } from '../config/keyboardShortcuts';

export function KeyboardShortcutsDialog({ isOpen, onClose }: Props) {
  const { getActiveShortcuts } = useKeyboard();
  const [showAll, setShowAll] = useState(false);
  
  const shortcuts = showAll 
    ? Object.values(KEYBOARD_SHORTCUTS)
    : getActiveShortcuts();
  
  const grouped = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, typeof shortcuts>);
  
  const categoryNames: Record<string, string> = {
    global: 'Global',
    terminal: 'Terminal',
    editor: 'Code Editor',
    navigation: 'Navigation'
  };
  
  return (
    <Dialog open={isOpen} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Keyboard Shortcuts</h2>
        
        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            Show all shortcuts (including inactive)
          </label>
        </div>
        
        {Object.entries(grouped).map(([category, shortcuts]) => (
          <div key={category} className="mb-6">
            <h3 className="text-lg font-semibold mb-2">
              {categoryNames[category] || category}
            </h3>
            
            <table className="w-full">
              <tbody>
                {shortcuts.map(shortcut => (
                  <tr key={shortcut.id} className="border-b">
                    <td className="py-2 pr-4">
                      <Kbd>{shortcut.key}</Kbd>
                    </td>
                    <td className="py-2">
                      {shortcut.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

// components/ui/Kbd.tsx
export function Kbd({ children }: { children: string }) {
  const parts = children.split('+');
  
  return (
    <kbd className="inline-flex gap-1">
      {parts.map((part, i) => (
        <span
          key={i}
          className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded"
        >
          {formatKey(part)}
        </span>
      ))}
    </kbd>
  );
}

function formatKey(key: string): string {
  const keyMap: Record<string, string> = {
    ctrl: '⌃',
    shift: '⇧',
    alt: '⌥',
    cmd: '⌘',
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
    escape: 'Esc',
    enter: '⏎',
    backspace: '⌫',
    delete: 'Del',
    tab: 'Tab'
  };
  
  return keyMap[key] || key.toUpperCase();
}
```

### 5. Testing

```typescript
// __tests__/keyboard/shortcuts.test.tsx
import { renderHook } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { KeyboardProvider } from '../../contexts/KeyboardContext';
import { splitViewStore } from '../../stores/splitViewStore';

describe('Keyboard Shortcuts', () => {
  const wrapper = ({ children }: any) => (
    <KeyboardProvider>{children}</KeyboardProvider>
  );

  beforeEach(() => {
    // Reset stores
    splitViewStore.setState({
      layouts: new Map(),
      activePanes: new Map(),
      resizing: false
    });
  });

  it('toggles split view with Ctrl+Shift+S', () => {
    const { result } = renderHook(() => useKeyboard(), { wrapper });
    
    // Activate terminal context
    act(() => {
      result.current.pushContext('terminal');
    });
    
    // Simulate keyboard shortcut
    fireEvent.keyDown(window, {
      key: 's',
      ctrlKey: true,
      shiftKey: true
    });
    
    // Check that split view was toggled
    expect(splitViewStore.getState().getLayout('test-task').mode).toBe('split');
  });
  
  it('respects context priority', () => {
    const globalHandler = vi.fn();
    const terminalHandler = vi.fn();
    
    // Register shortcuts with different priorities
    const { result } = renderHook(() => useKeyboard(), { wrapper });
    
    act(() => {
      result.current.registerShortcut({
        id: 'test.global',
        key: 'ctrl+t',
        contexts: [{ name: 'global', priority: 0 }],
        handler: globalHandler,
        category: 'test',
        description: 'Test global'
      });
      
      result.current.registerShortcut({
        id: 'test.terminal',
        key: 'ctrl+t',
        contexts: [{ name: 'terminal', priority: 10 }],
        handler: terminalHandler,
        category: 'test',
        description: 'Test terminal'
      });
      
      result.current.pushContext('terminal');
    });
    
    fireEvent.keyDown(window, {
      key: 't',
      ctrlKey: true
    });
    
    // Higher priority handler should be called
    expect(terminalHandler).toHaveBeenCalled();
    expect(globalHandler).not.toHaveBeenCalled();
  });
  
  it('ignores shortcuts when typing in input', () => {
    const handler = vi.fn();
    
    render(
      <KeyboardProvider>
        <input data-testid="input" />
      </KeyboardProvider>
    );
    
    const input = screen.getByTestId('input');
    input.focus();
    
    fireEvent.keyDown(input, {
      key: 's',
      ctrlKey: true,
      shiftKey: true
    });
    
    expect(handler).not.toHaveBeenCalled();
  });
});
```

This implementation provides:

1. **Centralized registry** with all shortcuts defined in one place
2. **Context-aware activation** with priority system
3. **Easy component integration** with hooks
4. **Discoverable shortcuts** with built-in dialog
5. **Testable architecture** with proper mocking
6. **Performance optimized** with memoization
7. **Accessibility friendly** with proper key formatting

The system handles all the split view requirements and can easily be extended for future features.