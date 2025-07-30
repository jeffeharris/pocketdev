/**
 * Keyboard shortcut hooks
 * 
 * These hooks provide easy integration with the keyboard shortcut system:
 * - useKeyboard: Access the keyboard context directly
 * - useShortcutContext: Activate a context while component is mounted
 * - useKeyboardShortcut: Register a shortcut dynamically
 * - useQuickAccess: Interact with the quick access panel
 */

export { useKeyboard } from '../contexts/KeyboardContext';
export { useShortcutContext } from './useShortcutContext';
export { useKeyboardShortcut } from './useKeyboardShortcut';
export { useQuickAccess } from './useQuickAccess';