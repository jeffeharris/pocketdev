import { useEffect, useRef } from 'react';
import { useKeyboard } from '../contexts/KeyboardContext';
import type { KeyboardShortcut } from '../types/keyboard';

interface UseKeyboardShortcutOptions {
  /** Contexts where this shortcut should be active */
  contexts?: string[];
  /** Whether the shortcut is enabled */
  enabled?: boolean;
  /** Whether to prevent default browser behavior */
  preventDefault?: boolean;
  /** Human-readable description for the shortcut */
  description?: string;
  /** Category for grouping in help dialog */
  category?: 'global' | 'terminal' | 'editor' | 'navigation';
}

/**
 * Hook to register a keyboard shortcut dynamically.
 * The shortcut is automatically cleaned up when the component unmounts.
 * 
 * @param key - The key combination (e.g., 'ctrl+s', 'alt+1')
 * @param handler - Function to call when the shortcut is triggered
 * @param options - Additional options for the shortcut
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   useKeyboardShortcut('ctrl+s', () => {
 *     saveDocument();
 *   }, {
 *     contexts: ['editor'],
 *     description: 'Save document',
 *     enabled: !isReadOnly
 *   });
 * }
 * ```
 */
export function useKeyboardShortcut(
  key: string,
  handler: (event: KeyboardEvent) => void,
  options: UseKeyboardShortcutOptions = {}
) {
  const { registerShortcut, unregisterShortcut } = useKeyboard();
  
  // Use ref to avoid recreating the shortcut on every render
  const shortcutIdRef = useRef<string>();
  
  // Context priorities to match the pushContext priorities
  const contextPriorityMap: Record<string, number> = {
    'global': 0,
    'terminal': 10,
    'diffViewer': 30,
    'commitModal': 30,
    'mergeWorkflow': 20
  };
  
  useEffect(() => {
    // Skip if disabled
    if (options.enabled === false) return;
    
    // Generate a unique ID for this shortcut
    const id = `dynamic-${key}-${Math.random().toString(36).substr(2, 9)}`;
    shortcutIdRef.current = id;
    
    const shortcut: KeyboardShortcut = {
      id,
      key,
      handler,
      description: options.description || `Dynamic shortcut: ${key}`,
      category: options.category || 'navigation',
      contexts: (options.contexts || ['global']).map(name => ({
        name,
        priority: contextPriorityMap[name] || 10 // Use context's priority or default to 10
      })),
      preventDefault: options.preventDefault !== false, // Default to true
      enabled: options.enabled !== false
    };
    
    registerShortcut(shortcut);
    
    return () => {
      if (shortcutIdRef.current) {
        unregisterShortcut(shortcutIdRef.current);
      }
    };
  }, [
    key,
    handler,
    options.enabled,
    options.contexts?.join(','), // Re-register if contexts change
    options.description,
    options.category,
    options.preventDefault,
    registerShortcut,
    unregisterShortcut
  ]);
}