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
export const KEYBOARD_SHORTCUTS: Record<string, KeyboardShortcut> = {
  // Global shortcuts
  'global.help': {
    id: 'global.help',
    key: 'f1',
    description: 'Show keyboard shortcuts',
    category: 'global',
    contexts: [{ name: 'global', priority: 0 }],
    handler: () => {
      // Dispatch event to show shortcuts dialog
      document.dispatchEvent(new CustomEvent('show-keyboard-shortcuts'));
    }
  },

  // Terminal tab navigation
  'terminal.tab.1': {
    id: 'terminal.tab.1',
    key: 'alt+1',
    description: 'Switch to tab 1',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => switchToTabByIndex(0)
  },
  'terminal.tab.2': {
    id: 'terminal.tab.2',
    key: 'alt+2',
    description: 'Switch to tab 2',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => switchToTabByIndex(1)
  },
  'terminal.tab.3': {
    id: 'terminal.tab.3',
    key: 'alt+3',
    description: 'Switch to tab 3',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => switchToTabByIndex(2)
  },
  'terminal.tab.4': {
    id: 'terminal.tab.4',
    key: 'alt+4',
    description: 'Switch to tab 4',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => switchToTabByIndex(3)
  },
  'terminal.tab.5': {
    id: 'terminal.tab.5',
    key: 'alt+5',
    description: 'Switch to tab 5',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => switchToTabByIndex(4)
  },
  'terminal.tab.6': {
    id: 'terminal.tab.6',
    key: 'alt+6',
    description: 'Switch to tab 6',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => switchToTabByIndex(5)
  },

  // Terminal tab management
  'terminal.tab.new': {
    id: 'terminal.tab.new',
    key: 'ctrl+shift+t',
    description: 'New terminal tab',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => {
      // Dispatch event to create new tab
      document.dispatchEvent(new CustomEvent('terminal-new-tab'));
    }
  },
  'terminal.tab.close': {
    id: 'terminal.tab.close',
    key: 'ctrl+shift+w',
    description: 'Close current tab',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => {
      // Dispatch event to close current tab
      document.dispatchEvent(new CustomEvent('terminal-close-tab'));
    }
  },

  // Terminal tab cycling
  'terminal.tab.next': {
    id: 'terminal.tab.next',
    key: 'ctrl+tab',
    description: 'Next terminal tab',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => {
      document.dispatchEvent(new CustomEvent('terminal-next-tab'));
    }
  },
  'terminal.tab.previous': {
    id: 'terminal.tab.previous',
    key: 'ctrl+shift+tab',
    description: 'Previous terminal tab',
    category: 'terminal',
    contexts: [{ name: 'terminal', priority: 10 }],
    handler: () => {
      document.dispatchEvent(new CustomEvent('terminal-previous-tab'));
    }
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