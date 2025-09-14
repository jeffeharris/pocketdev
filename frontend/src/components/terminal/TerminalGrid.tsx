/**
 * TerminalGrid Component
 * 
 * Handles all terminal rendering logic for different layout modes.
 * Extracts ~120 lines of complex rendering from TerminalPanel.
 * 
 * Responsible for:
 * - Rendering terminals in different layout modes (tab/split/quad)
 * - Managing terminal visibility based on layout
 * - Rendering empty panels for missing terminals
 * - Managing terminal refs for direct access
 */

import React, { forwardRef } from 'react';
import { DirectTerminal } from './DirectTerminal';
import { EmptyTerminalPanel } from './EmptyTerminalPanel';
import { SplitViewContainer } from './SplitViewContainer';
import type { TerminalSession, Task } from '../../types/task';
import type { SplitLayoutConfig } from '../../stores/splitViewStore';
import type { DirectTerminalHandle } from './DirectTerminal';

interface TerminalGridProps {
  // Core data
  task: Task;
  terminals: TerminalSession[];
  
  // Layout configuration
  layout: SplitLayoutConfig;
  activeTabId: string;
  
  // Visibility and focus
  isVisible: boolean;
  focusedTerminalId: string | null;
  
  // State flags
  isResetting: boolean;
  
  // Callbacks
  onSessionStatus: (dbSessionId: string, status: 'connected' | 'disconnected' | 'error') => void;
  onFocusRequest: (terminalId: string) => void;
  onEmptyPanelAction: (action: 'claude' | 'bash' | 'advanced') => void;
  onResetStateChange: (isResetting: boolean) => void;
  onTerminalReorder: (draggedId: string, targetId: string) => void;
  
  // Render props
  renderControlButtons: () => React.ReactNode;
  
  // Ref management
  terminalRefs: React.MutableRefObject<Map<string, DirectTerminalHandle>>;
}

export const TerminalGrid = forwardRef<HTMLDivElement, TerminalGridProps>(({
  task,
  terminals,
  layout,
  activeTabId,
  isVisible,
  focusedTerminalId,
  isResetting,
  onSessionStatus,
  onFocusRequest,
  onEmptyPanelAction,
  onResetStateChange,
  onTerminalReorder,
  renderControlButtons,
  terminalRefs
}, ref) => {
  // Helper functions (moved from props to internal implementation)
  const shouldShowTerminal = (
    terminal: TerminalSession, 
    layout: SplitLayoutConfig, 
    activeTabId: string
  ): boolean => {
    const terminalIndex = terminals.findIndex(t => t.dbSessionId === terminal.dbSessionId);
    const terminalNormalizedId = terminal.normalizedId;
    
    switch (layout.mode) {
      case 'tab':
        return terminalNormalizedId === activeTabId;
      case 'split':
        // Always show first 2 terminals in split mode
        return terminalIndex >= 0 && terminalIndex < 2;
      case 'split-4':
        // Always show first 4 terminals in quad mode
        return terminalIndex >= 0 && terminalIndex < 4;
      default:
        return false;
    }
  };

  const getTerminalClassName = (
    terminal: TerminalSession, 
    layout: SplitLayoutConfig
  ): string => {
    if (layout.mode === 'tab') return 'terminal terminal-tab';
    
    const terminalIndex = terminals.findIndex(t => t.dbSessionId === terminal.dbSessionId);
    
    // For split/quad modes, use order-based positioning
    if (layout.mode === 'split') {
      if (terminalIndex === 0) return 'terminal terminal-primary';
      if (terminalIndex === 1) return 'terminal terminal-secondary';
    } else if (layout.mode === 'split-4') {
      if (terminalIndex === 0) return 'terminal terminal-primary';
      if (terminalIndex === 1) return 'terminal terminal-secondary';
      if (terminalIndex === 2) return 'terminal terminal-tertiary';
      if (terminalIndex === 3) return 'terminal terminal-quaternary';
    }
    
    return 'terminal terminal-hidden';
  };

  // Helper to render empty panel based on position
  const renderEmptyPanel = (className: string) => (
    <div className={`terminal-wrapper ${className}`}>
      <EmptyTerminalPanel 
        onCreateTerminal={onEmptyPanelAction}
        layout={layout}
      />
    </div>
  );

  return (
    <div ref={ref} className="flex-1 bg-gray-900 relative overflow-hidden min-h-0">
      {/* Render all terminals with CSS-based visibility */}
      <div 
        className={`terminals-container mode-${layout.mode} ${layout.mode === 'split' ? `orientation-${layout.orientation}` : ''}`}
        style={{
          '--split-ratio': `${layout.splitRatio * 100}%`,
          '--split-ratio-fr': `${layout.splitRatio}fr`,
          '--split-complement-fr': `${1 - layout.splitRatio}fr`
        } as React.CSSProperties}>
        
        {/* Render existing terminals */}
        {terminals.map(terminal => {
          const isVisibleTerminal = shouldShowTerminal(terminal, layout, activeTabId);
          const terminalClassName = getTerminalClassName(terminal, layout);
          const normalizedId = terminal.normalizedId || terminal.dbSessionId; // Fallback to dbSessionId if no normalized ID
          
          return (
            <div
              key={terminal.dbSessionId}
              className={`terminal-wrapper ${terminalClassName}`}
              style={{ 
                display: isVisibleTerminal ? 'block' : 'none'
              }}
            >
              <DirectTerminal
                ref={(el) => {
                  if (el) {
                    terminalRefs.current.set(terminal.dbSessionId, el);
                  } else {
                    terminalRefs.current.delete(terminal.dbSessionId);
                  }
                }}
                taskId={task.id}
                dbSessionId={terminal.dbSessionId}
                shelltenderSessionId={terminal.shelltenderSessionId || terminal.sessionId}
                worktreePath={task.worktree_path}
                isVisible={isVisibleTerminal && isVisible}
                hasFocus={focusedTerminalId === normalizedId}
                onSessionStatus={(status) => onSessionStatus(terminal.dbSessionId, status)}
                onFocusRequest={() => onFocusRequest(normalizedId)}
              />
            </div>
          );
        })}
        
        {/* Render empty panels for split mode (needs 2 terminals) */}
        {layout.mode === 'split' && terminals.length < 2 && (
          <>
            {terminals.length === 0 && renderEmptyPanel('terminal-primary')}
            {terminals.length <= 1 && renderEmptyPanel('terminal-secondary')}
          </>
        )}
        
        {/* Render empty panels for quad mode (needs 4 terminals) */}
        {layout.mode === 'split-4' && terminals.length < 4 && (
          <>
            {terminals.length === 0 && renderEmptyPanel('terminal-primary')}
            {terminals.length <= 1 && renderEmptyPanel('terminal-secondary')}
            {terminals.length <= 2 && renderEmptyPanel('terminal-tertiary')}
            {terminals.length <= 3 && renderEmptyPanel('terminal-quaternary')}
          </>
        )}
      </div>
      
      {/* Overlay split view controls when in split/quad modes */}
      {(layout.mode === 'split' || layout.mode === 'split-4') && (
        <SplitViewContainer
          taskId={task.id}
          projectId={task.project_id}
          worktreePath={task.worktree_path}
          isVisible={isVisible}
          onSessionStatus={onSessionStatus}
          activeTabId={activeTabId}
          controlButtons={renderControlButtons()}
          isResetting={isResetting}
          setIsResetting={onResetStateChange}
          onTerminalReorder={onTerminalReorder}
        />
      )}
    </div>
  );
});

TerminalGrid.displayName = 'TerminalGrid';