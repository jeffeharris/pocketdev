import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { KEYBOARD_SHORTCUTS, isInInputContext, setToggleQuickAccess } from '../config/keyboardShortcuts';
import type { KeyboardShortcut, KeyboardContextValue } from '../types/keyboard';
import { QuickAccessPanel } from '../components/keyboard/QuickAccessPanel';

const KeyboardContext = createContext<KeyboardContextValue | null>(null);

export function useKeyboard() {
  const context = useContext(KeyboardContext);
  if (!context) {
    throw new Error('useKeyboard must be used within KeyboardProvider');
  }
  return context;
}

interface KeyboardProviderProps {
  children: React.ReactNode;
}

export function KeyboardProvider({ children }: KeyboardProviderProps) {
  // Initialize with built-in shortcuts
  const [shortcuts] = useState(() => new Map(Object.entries(KEYBOARD_SHORTCUTS)));
  
  // Track active contexts with their priorities
  const [activeContexts, setActiveContexts] = useState<Set<string>>(new Set(['global']));
  const [contextPriorities, setContextPriorities] = useState<Map<string, number>>(new Map([['global', 0]]));
  
  // Track dynamic shortcuts added at runtime
  const [dynamicShortcuts, setDynamicShortcuts] = useState<Map<string, KeyboardShortcut>>(new Map());
  
  // Track context reference counts for proper cleanup
  const contextRefs = useRef<Map<string, number>>(new Map());
  
  // Quick access panel state
  const [isQuickAccessOpen, setIsQuickAccessOpen] = useState(false);

  // Format keyboard event to normalized key string
  const formatKeyCombo = useCallback((event: KeyboardEvent): string => {
    const parts: string[] = [];
    
    // Use Cmd on Mac, Ctrl on Windows/Linux
    if (event.ctrlKey || event.metaKey) parts.push('ctrl');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');
    
    // Normalize key name
    let key = event.key.toLowerCase();
    
    // Handle special keys
    const keyMap: Record<string, string> = {
      'arrowleft': 'arrowleft',
      'arrowright': 'arrowright',
      'arrowup': 'arrowup',
      'arrowdown': 'arrowdown',
      'escape': 'escape',
      'enter': 'enter',
      ' ': 'space',
      'tab': 'tab',
      'delete': 'delete',
      'backspace': 'backspace'
    };
    
    key = keyMap[key] || key;
    
    // Handle numeric keys
    if (event.code && event.code.startsWith('Digit')) {
      key = event.code.replace('Digit', '');
    }
    
    parts.push(key);
    
    return parts.join('+');
  }, []);

  // Get all currently active shortcuts
  const getActiveShortcuts = useCallback((): KeyboardShortcut[] => {
    const allShortcuts = [...shortcuts.values(), ...dynamicShortcuts.values()];
    
    // Find the highest priority active context (30+ is modal priority)
    let hasModalContext = false;
    
    for (const [context, priority] of contextPriorities) {
      if (activeContexts.has(context) && priority >= 30) {
        hasModalContext = true;
        break;
      }
    }
    
    return allShortcuts.filter(shortcut => {
      // Check if enabled
      if (shortcut.enabled === false) return false;
      
      // Check if any context is active
      return shortcut.contexts.some(ctx => {
        // Check if context is active
        if (!activeContexts.has(ctx.name)) return false;
        
        // If a modal is open (priority 30+), exclude non-global shortcuts from contexts with priority < 30
        if (hasModalContext && ctx.name !== 'global') {
          // Get the priority of this context
          const ctxPriority = contextPriorities.get(ctx.name) || ctx.priority;
          if (ctxPriority < 30) {
            return false;
          }
        }
        
        // Check dynamic test if provided
        if (ctx.test && !ctx.test()) return false;
        
        return true;
      });
    });
  }, [shortcuts, dynamicShortcuts, activeContexts, contextPriorities]);

  // Push a context onto the stack
  const pushContext = useCallback((context: string, priority: number = 10) => {
    if (!context) return;
    
    setActiveContexts(prev => new Set([...prev, context]));
    setContextPriorities(prev => new Map([...prev, [context, priority]]));
    
    // Track reference count
    const refs = contextRefs.current;
    refs.set(context, (refs.get(context) || 0) + 1);
    
  }, []);

  // Pop a context from the stack
  const popContext = useCallback((context: string) => {
    if (!context) return;
    
    const refs = contextRefs.current;
    const count = refs.get(context) || 0;
    
    if (count <= 1) {
      // Last reference, remove context
      refs.delete(context);
      // Use React's batching to prevent multiple state updates during unmount
      React.startTransition(() => {
        setActiveContexts(prev => {
          const next = new Set(prev);
          next.delete(context);
          return next;
        });
        setContextPriorities(prev => {
          const next = new Map(prev);
          next.delete(context);
          return next;
        });
      });
    } else {
      // Decrement reference count
      refs.set(context, count - 1);
    }
    
  }, []);

  // Register a dynamic shortcut
  const registerShortcut = useCallback((shortcut: KeyboardShortcut) => {
    setDynamicShortcuts(prev => new Map(prev).set(shortcut.id, shortcut));
  }, []);

  // Unregister a dynamic shortcut
  const unregisterShortcut = useCallback((id: string) => {
    // Use React's batching to prevent multiple state updates during unmount
    React.startTransition(() => {
      setDynamicShortcuts(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    });
  }, []);

  // Check if a shortcut is active
  const isShortcutActive = useCallback((id: string): boolean => {
    const shortcut = shortcuts.get(id) || dynamicShortcuts.get(id);
    if (!shortcut) return false;
    
    return getActiveShortcuts().some(s => s.id === id);
  }, [shortcuts, dynamicShortcuts, getActiveShortcuts]);

  // Get shortcut by key combination
  const getShortcutByKey = useCallback((key: string): KeyboardShortcut | undefined => {
    return getActiveShortcuts().find(s => s.key === key);
  }, [getActiveShortcuts]);
  
  // Toggle quick access panel
  const toggleQuickAccess = useCallback(() => {
    setIsQuickAccessOpen(prev => !prev);
  }, []);
  
  // Set the toggle function for the shortcuts to use
  useEffect(() => {
    setToggleQuickAccess(toggleQuickAccess);
  }, [toggleQuickAccess]);

  // Global keyboard event handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if user is typing in an input (but not terminal)
      if (isInInputContext()) {
        // Special case: Allow terminal-specific shortcuts even when terminal is focused
        const isTerminalFocused = (event.target as HTMLElement)?.classList.contains('xterm-helper-textarea');
        if (!isTerminalFocused) {
          return;
        }
      }

      const key = formatKeyCombo(event);
      
      // Inline the active shortcuts logic to avoid dependency issues
      const allShortcuts = [...shortcuts.values(), ...dynamicShortcuts.values()];
      
      // Find the highest priority active context (30+ is modal priority)
      let hasModalContext = false;
      
      for (const [context, priority] of contextPriorities) {
        if (activeContexts.has(context) && priority >= 30) {
          hasModalContext = true;
          break;
        }
      }
      
      const activeShortcuts = allShortcuts.filter(shortcut => {
        // Check if enabled
        if (shortcut.enabled === false) return false;
        
        // Check if any context is active
        return shortcut.contexts.some(ctx => {
          // Check if context is active
          if (!activeContexts.has(ctx.name)) return false;
          
          // If a modal is open (priority 30+), exclude non-global shortcuts from contexts with priority < 30
          if (hasModalContext && ctx.name !== 'global') {
            // Get the priority of this context
            const ctxPriority = contextPriorities.get(ctx.name) || ctx.priority;
            if (ctxPriority < 30) {
              return false;
            }
          }
          
          // Check dynamic test if provided
          if (ctx.test && !ctx.test()) return false;
          
          return true;
        });
      });
      
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
          console.error(`[Keyboard] Error in shortcut handler ${shortcut.id}:`, error);
        }
      }
    };

    // Use capture phase to intercept events before they reach other handlers
    window.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [formatKeyCombo, shortcuts, dynamicShortcuts, activeContexts, contextPriorities]);

  const value: KeyboardContextValue = {
    registerShortcut,
    unregisterShortcut,
    pushContext,
    popContext,
    isShortcutActive,
    getActiveShortcuts,
    getShortcutByKey,
    toggleQuickAccess,
    isQuickAccessOpen
  };

  return (
    <KeyboardContext.Provider value={value}>
      {children}
      <QuickAccessPanel 
        isOpen={isQuickAccessOpen} 
        onClose={() => setIsQuickAccessOpen(false)} 
      />
    </KeyboardContext.Provider>
  );
}