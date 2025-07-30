/**
 * Keyboard shortcut system types
 */

export interface ShortcutContext {
  /** Unique name for the context (e.g., 'global', 'terminal', 'splitView') */
  name: string;
  /** Higher priority contexts override lower ones when shortcuts conflict */
  priority: number;
  /** Optional dynamic test to check if context should be active */
  test?: () => boolean;
}

export interface KeyboardShortcut {
  /** Unique identifier for the shortcut */
  id: string;
  /** Key combination (e.g., 'ctrl+shift+s', 'alt+1') */
  key: string;
  /** Human-readable description */
  description: string;
  /** Category for grouping in help dialog */
  category: 'global' | 'terminal' | 'editor' | 'navigation' | 'actions';
  /** Contexts where this shortcut is active */
  contexts: ShortcutContext[];
  /** Handler function called when shortcut is triggered */
  handler: (event: KeyboardEvent) => void | boolean;
  /** Whether the shortcut is currently enabled */
  enabled?: boolean;
  /** Whether to prevent default browser behavior */
  preventDefault?: boolean;
  /** Optional icon component or Lucide icon name for visual representation */
  icon?: React.ComponentType<{ className?: string }> | string;
  /** Hide this shortcut from the quick access panel */
  hidden?: boolean;
}

export interface KeyboardContextValue {
  /** Register a new shortcut dynamically */
  registerShortcut: (shortcut: KeyboardShortcut) => void;
  /** Unregister a shortcut by ID */
  unregisterShortcut: (id: string) => void;
  /** Activate a context with optional priority (can be called multiple times) */
  pushContext: (context: string, priority?: number) => void;
  /** Deactivate a context (respects reference counting) */
  popContext: (context: string) => void;
  /** Check if a specific shortcut is currently active */
  isShortcutActive: (id: string) => boolean;
  /** Get all currently active shortcuts */
  getActiveShortcuts: () => KeyboardShortcut[];
  /** Find a shortcut by key combination */
  getShortcutByKey: (key: string) => KeyboardShortcut | undefined;
  /** Show/hide the quick access panel */
  toggleQuickAccess: () => void;
  /** Current state of quick access panel */
  isQuickAccessOpen: boolean;
}