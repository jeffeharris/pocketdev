import type { KeyboardShortcut } from '../types/keyboard';

/**
 * Centralized keyboard shortcut registry
 * 
 * Priority guidelines:
 * - Global: 0-9
 * - Feature-level: 10-19
 * - Component-level: 20-29
 * - Modal/Dialog: 30+
 */
// Helper function to toggle quick access (will be set by KeyboardContext)
let toggleQuickAccessFn: (() => void) | null = null;
export const setToggleQuickAccess = (fn: () => void) => {
  toggleQuickAccessFn = fn;
};

export const KEYBOARD_SHORTCUTS: Record<string, KeyboardShortcut> = {
  // Global shortcuts
  'global.quickAccess': {
    id: 'global.quickAccess',
    key: 'ctrl+k',
    description: 'Show quick access panel',
    category: 'global',
    contexts: [{ name: 'global', priority: 0 }],
    handler: () => {
      if (toggleQuickAccessFn) {
        toggleQuickAccessFn();
      }
    },
    hidden: true // Hide from panel to avoid recursion
  },
  
  'global.quickAccess.alt': {
    id: 'global.quickAccess.alt',
    key: 'ctrl+space',
    description: 'Show quick access panel',
    category: 'global',
    contexts: [{ name: 'global', priority: 0 }],
    handler: () => {
      if (toggleQuickAccessFn) {
        toggleQuickAccessFn();
      }
    },
    hidden: true // Hide from panel to avoid recursion
  },

  // Terminal tab navigation
  'terminal.tab.1': {
    id: 'terminal.tab.1',
    key: 'alt+1',
    description: 'Switch to tab 1',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => switchToTabByIndex(0),
    icon: '1️⃣'
  },
  'terminal.tab.2': {
    id: 'terminal.tab.2',
    key: 'alt+2',
    description: 'Switch to tab 2',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => switchToTabByIndex(1),
    icon: '2️⃣'
  },
  'terminal.tab.3': {
    id: 'terminal.tab.3',
    key: 'alt+3',
    description: 'Switch to tab 3',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => switchToTabByIndex(2),
    icon: '3️⃣'
  },
  'terminal.tab.4': {
    id: 'terminal.tab.4',
    key: 'alt+4',
    description: 'Switch to tab 4',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => switchToTabByIndex(3),
    icon: '4️⃣'
  },
  'terminal.tab.5': {
    id: 'terminal.tab.5',
    key: 'alt+5',
    description: 'Switch to tab 5',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => switchToTabByIndex(4),
    icon: '5️⃣'
  },
  'terminal.tab.6': {
    id: 'terminal.tab.6',
    key: 'alt+6',
    description: 'Switch to tab 6',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => switchToTabByIndex(5),
    icon: '6️⃣'
  },

  // Terminal tab management
  'terminal.tab.new': {
    id: 'terminal.tab.new',
    key: 'alt+t',
    description: 'New terminal tab',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => {
      // Dispatch event to create new tab
      document.dispatchEvent(new CustomEvent('terminal-new-tab'));
    },
    icon: '➕'
  },
  'terminal.tab.close': {
    id: 'terminal.tab.close',
    key: 'alt+w',
    description: 'Close current tab',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => {
      // Dispatch event to close current tab
      document.dispatchEvent(new CustomEvent('terminal-close-tab'));
    },
    icon: '❌'
  },

  // Terminal tab cycling
  'terminal.tab.next': {
    id: 'terminal.tab.next',
    key: 'alt+]',
    description: 'Next terminal tab',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => {
      document.dispatchEvent(new CustomEvent('terminal-next-tab'));
    },
    icon: '➡️'
  },
  'terminal.tab.previous': {
    id: 'terminal.tab.previous',
    key: 'alt+[',
    description: 'Previous terminal tab',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => {
      document.dispatchEvent(new CustomEvent('terminal-previous-tab'));
    },
    icon: '⬅️'
  },
};

// Helper function to switch to a tab by index
function switchToTabByIndex(index: number) {
  document.dispatchEvent(new CustomEvent('terminal-switch-tab', {
    detail: { index }
  }));
}

// Helper to check if user is typing in an input
export function isInInputContext(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;
  
  const tagName = activeElement.tagName;
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    activeElement.getAttribute('contenteditable') === 'true' ||
    // Check if we're in a terminal (xterm textarea)
    activeElement.classList.contains('xterm-helper-textarea')
  );
}

// Helper to check if a modal is open
export function isModalOpen(): boolean {
  return document.querySelector('[role="dialog"]') !== null;
}