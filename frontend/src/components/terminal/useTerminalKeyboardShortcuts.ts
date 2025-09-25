/**
 * useTerminalKeyboardShortcuts Hook
 * 
 * Centralizes all keyboard shortcut handling for the TerminalPanel.
 * Extracts ~130 lines of event handling logic into a dedicated hook.
 * 
 * This hook listens for terminal-specific keyboard events dispatched by
 * the centralized keyboard shortcut system and translates them into actions.
 */

import { useEffect } from 'react';
import type { TerminalSession } from '@shared/types';
import type { SplitLayoutConfig } from '../../stores/splitViewStore';

interface UseTerminalKeyboardShortcutsProps {
  // Core state
  isVisible: boolean;
  terminals: TerminalSession[];
  activeTabId: string;
  
  // Layout state
  layout: SplitLayoutConfig;
  canShowVertical: boolean;
  canShowHorizontal: boolean;
  canShowQuad: boolean;
  
  // Action handlers
  handleTabAdd: () => void;
  handleTabClose: (tabId: string) => void;
  handleTabSelect: (tabId: string) => void;
  handleRefreshSession: () => void;
  updateLayout: (updates: Partial<SplitLayoutConfig>) => void;
  saveLayout: () => void;
  onToggleSidebar: () => void;
}

export function useTerminalKeyboardShortcuts({
  isVisible,
  terminals,
  activeTabId,
  layout,
  canShowVertical,
  canShowHorizontal,
  canShowQuad,
  handleTabAdd,
  handleTabClose,
  handleTabSelect,
  handleRefreshSession,
  updateLayout,
  saveLayout,
  onToggleSidebar
}: UseTerminalKeyboardShortcutsProps) {
  useEffect(() => {
    const handleTerminalShortcut = (event: CustomEvent) => {
      // Skip all events if this panel is not visible
      if (!isVisible) return;
      
      switch (event.type) {
        case 'terminal-new-tab':
          if (terminals.length < 6) {
            handleTabAdd();
          }
          break;
          
        case 'terminal-close-tab':
          if (activeTabId && terminals.length > 1) {
            handleTabClose(activeTabId);
          }
          break;
          
        case 'terminal-next-tab': {
          const currentIndex = terminals.findIndex(t => 
            t.normalizedId === activeTabId
          );
          const nextIndex = (currentIndex + 1) % terminals.length;
          if (terminals[nextIndex]) {
            const nextTerminalId = terminals[nextIndex].normalizedId;
            handleTabSelect(nextTerminalId);
          }
          break;
        }
        
        case 'terminal-previous-tab': {
          const currentIndex = terminals.findIndex(t => 
            t.normalizedId === activeTabId
          );
          const prevIndex = currentIndex === 0 ? terminals.length - 1 : currentIndex - 1;
          if (terminals[prevIndex]) {
            const prevTerminalId = terminals[prevIndex].normalizedId;
            handleTabSelect(prevTerminalId);
          }
          break;
        }
        
        case 'terminal-switch-tab': {
          const detail = event.detail;
          if (detail && typeof detail.index === 'number' && terminals[detail.index]) {
            const targetTerminalId = terminals[detail.index].normalizedId;
            handleTabSelect(targetTerminalId);
          }
          break;
        }
        
        case 'terminal-toggle-split':
          handleSplitToggle();
          break;
          
        case 'terminal-toggle-fullscreen':
          onToggleSidebar();
          break;
          
        case 'terminal-refresh':
          handleRefreshSession();
          break;
      }
    };
    
    const handleSplitToggle = () => {
      if (layout.mode === 'tab') {
        // Switch to vertical split if allowed, otherwise horizontal, otherwise stay in tab
        if (canShowVertical) {
          updateLayout({ mode: 'split', orientation: 'vertical' });
        } else if (canShowHorizontal) {
          updateLayout({ mode: 'split', orientation: 'horizontal' });
        }
        // If neither split view is possible, stay in tab mode
      } else if (layout.mode === 'split' && layout.orientation === 'vertical') {
        // Switch to horizontal split if allowed, otherwise quad if allowed, otherwise tab
        if (canShowHorizontal) {
          updateLayout({ orientation: 'horizontal' });
        } else if (canShowQuad) {
          updateLayout({ mode: 'split-4' });
        } else {
          updateLayout({ mode: 'tab' });
        }
      } else if (layout.mode === 'split' && layout.orientation === 'horizontal') {
        // Switch to quad view if allowed, otherwise back to tab
        if (canShowQuad) {
          updateLayout({ mode: 'split-4' });
        } else {
          updateLayout({ mode: 'tab' });
        }
      } else {
        // From quad view, always go back to tab mode
        updateLayout({ mode: 'tab' });
      }
      // Save layout after any changes
      saveLayout();
    };

    // Register all event listeners
    const events = [
      'terminal-new-tab',
      'terminal-close-tab',
      'terminal-next-tab',
      'terminal-previous-tab',
      'terminal-switch-tab',
      'terminal-toggle-split',
      'terminal-toggle-fullscreen',
      'terminal-refresh'
    ];
    
    events.forEach(eventType => {
      document.addEventListener(eventType, handleTerminalShortcut as EventListener);
    });

    // Cleanup
    return () => {
      events.forEach(eventType => {
        document.removeEventListener(eventType, handleTerminalShortcut as EventListener);
      });
    };
  }, [
    isVisible,
    terminals,
    activeTabId,
    layout.mode,
    layout.orientation,
    canShowVertical,
    canShowHorizontal,
    canShowQuad,
    handleTabAdd,
    handleTabClose,
    handleTabSelect,
    handleRefreshSession,
    updateLayout,
    saveLayout,
    onToggleSidebar
  ]);
}