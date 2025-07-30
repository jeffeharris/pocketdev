/**
 * Hook to interact with the quick access panel
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { toggleQuickAccess, isOpen } = useQuickAccess();
 *   
 *   return (
 *     <button onClick={toggleQuickAccess}>
 *       Open Quick Access ({isOpen ? 'Open' : 'Closed'})
 *     </button>
 *   );
 * }
 * ```
 */

import { useKeyboard } from '../contexts/KeyboardContext';

export function useQuickAccess() {
  const { toggleQuickAccess, isQuickAccessOpen } = useKeyboard();
  
  return {
    toggleQuickAccess,
    isOpen: isQuickAccessOpen
  };
}