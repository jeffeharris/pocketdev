import { useEffect } from 'react';
import { useKeyboard } from '../contexts/KeyboardContext';

/**
 * Hook to activate a keyboard shortcut context while a component is mounted.
 * Handles cleanup automatically when the component unmounts.
 * 
 * @param context - The context name to activate (e.g., 'terminal', 'modal')
 * 
 * @example
 * ```tsx
 * function TerminalPanel() {
 *   // Activates 'terminal' context while this component is mounted
 *   useShortcutContext('terminal');
 *   
 *   return <div>...</div>;
 * }
 * ```
 */
export function useShortcutContext(context: string | null) {
  const { pushContext, popContext } = useKeyboard();
  
  useEffect(() => {
    if (!context) return;
    
    pushContext(context);
    return () => popContext(context);
  }, [context, pushContext, popContext]);
}