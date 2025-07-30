import { useEffect } from 'react';
import { useKeyboard } from '../contexts/KeyboardContext';

interface ShortcutContextOptions {
  enabled?: boolean;
  priority?: number;
}

/**
 * Hook to activate a keyboard shortcut context while a component is mounted.
 * Handles cleanup automatically when the component unmounts.
 * 
 * @param context - The context name to activate (e.g., 'terminal', 'modal')
 * @param options - Optional configuration
 * 
 * @example
 * ```tsx
 * function TerminalPanel({ isVisible }) {
 *   // Activates 'terminal' context only when visible
 *   useShortcutContext('terminal', { enabled: isVisible });
 *   
 *   return <div>...</div>;
 * }
 * ```
 */
export function useShortcutContext(context: string | null, options?: ShortcutContextOptions) {
  const { pushContext, popContext } = useKeyboard();
  const enabled = options?.enabled ?? true;
  
  useEffect(() => {
    if (!context || !enabled) return;
    
    pushContext(context, options?.priority);
    return () => popContext(context);
  }, [context, enabled, options?.priority, pushContext, popContext]);
}