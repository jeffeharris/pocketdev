import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { KEYBOARD_SHORTCUTS, isInInputContext } from '../config/keyboardShortcuts';
import type { KeyboardShortcut, KeyboardContextValue } from '../types/keyboard';

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
  
  // Track active contexts
  const [activeContexts, setActiveContexts] = useState<Set<string>>(new Set(['global']));
  
  // Track dynamic shortcuts added at runtime
  const [dynamicShortcuts, setDynamicShortcuts] = useState<Map<string, KeyboardShortcut>>(new Map());
  
  // Track context reference counts for proper cleanup
  const contextRefs = useRef<Map<string, number>>(new Map());

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
      'tab': 'tab'
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
    
    return allShortcuts.filter(shortcut => {
      // Check if enabled
      if (shortcut.enabled === false) return false;
      
      // Check if any context is active
      return shortcut.contexts.some(ctx => {
        // Check if context is active
        if (!activeContexts.has(ctx.name)) return false;
        
        // Check dynamic test if provided
        if (ctx.test && !ctx.test()) return false;
        
        return true;
      });
    });
  }, [shortcuts, dynamicShortcuts, activeContexts]);

  // Push a context onto the stack
  const pushContext = useCallback((context: string) => {
    if (!context) return;
    
    setActiveContexts(prev => new Set([...prev, context]));
    
    // Track reference count
    const refs = contextRefs.current;
    refs.set(context, (refs.get(context) || 0) + 1);
    
    console.debug(`[Keyboard] Context pushed: ${context}`, Array.from(activeContexts));
  }, [activeContexts]);

  // Pop a context from the stack
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
    
    console.debug(`[Keyboard] Context popped: ${context}`, Array.from(activeContexts));
  }, [activeContexts]);

  // Register a dynamic shortcut
  const registerShortcut = useCallback((shortcut: KeyboardShortcut) => {
    setDynamicShortcuts(prev => new Map(prev).set(shortcut.id, shortcut));
    console.debug(`[Keyboard] Shortcut registered: ${shortcut.id} (${shortcut.key})`);
  }, []);

  // Unregister a dynamic shortcut
  const unregisterShortcut = useCallback((id: string) => {
    setDynamicShortcuts(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    console.debug(`[Keyboard] Shortcut unregistered: ${id}`);
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
        
        console.debug(`[Keyboard] Shortcut triggered: ${shortcut.id} (${key})`);
        
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
  }, [formatKeyCombo, getActiveShortcuts]);

  const value: KeyboardContextValue = {
    registerShortcut,
    unregisterShortcut,
    pushContext,
    popContext,
    isShortcutActive,
    getActiveShortcuts,
    getShortcutByKey
  };

  return (
    <KeyboardContext.Provider value={value}>
      {children}
    </KeyboardContext.Provider>
  );
}