/**
 * Keyboard shortcut hooks
 * 
 * These hooks provide easy integration with the keyboard shortcut system:
 * - useKeyboard: Access the keyboard context directly
 * - useShortcutContext: Activate a context while component is mounted
 * - useKeyboardShortcut: Register a shortcut dynamically
 */

export { useKeyboard } from '../contexts/KeyboardContext';
export { useShortcutContext } from './useShortcutContext';
export { useKeyboardShortcut } from './useKeyboardShortcut';