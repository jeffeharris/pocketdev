import { forwardRef, useEffect } from 'react';
import { ChevronDown, ArrowLeftRight } from 'lucide-react';
import { ThrottledTerminal } from './ThrottledTerminal';
import type { DirectTerminalHandle } from './DirectTerminal';
import type { TerminalSession } from '../../types/task';
import { useSplitLayout } from '../../stores/splitViewStore';

interface TerminalPaneProps {
  terminal: TerminalSession | undefined;
  terminals: TerminalSession[];
  taskId: string;
  worktreePath: string;
  isVisible: boolean;
  hasFocus: boolean;
  showControls?: boolean;
  controlButtons?: React.ReactNode;
  showDropdown: boolean;
  onDropdownToggle: () => void;
  onTerminalSelect: (terminalId: string) => void;
  onSessionStatus: (status: 'connected' | 'disconnected' | 'error') => void;
  onFocusRequest: () => void;
  onSwap?: () => void;
  position: 'primary' | 'secondary' | 'tertiary' | 'quaternary';
  getStateColor: (state?: string) => string;
}

export const TerminalPane = forwardRef<DirectTerminalHandle, TerminalPaneProps>(({
  terminal,
  terminals,
  taskId,
  worktreePath,
  isVisible,
  hasFocus,
  showControls = false,
  controlButtons,
  showDropdown,
  onDropdownToggle,
  onTerminalSelect,
  onSessionStatus,
  onFocusRequest,
  onSwap,
  position,
  getStateColor
}, ref) => {
  const otherPosition = position === 'primary' ? 'secondary' : 'primary';
  const layout = useSplitLayout(taskId);
  
  // Get all terminal IDs that are currently assigned to panes
  const assignedTerminalIds = [
    layout.primaryTerminalId,
    layout.secondaryTerminalId,
    layout.tertiaryTerminalId,
    layout.quaternaryTerminalId
  ].filter(Boolean) as string[];
  
  // Filter out the current terminal's ID to get the ones that are "in use" by other panes
  const terminalsInUse = assignedTerminalIds.filter(id => id !== terminal?.dbSessionId);
  
  // Focus terminal when it changes and hasFocus is true
  useEffect(() => {
    if (terminal && hasFocus && ref && 'current' in ref && ref.current) {
      // Small delay to ensure terminal is fully mounted
      const timer = setTimeout(() => {
        ref.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [terminal?.dbSessionId, hasFocus]);
  
  return (
    <div className="flex flex-col h-full w-full">
      {/* Terminal Header Bar - Always shown */}
      <div className="bg-gray-800 border-b border-gray-700 px-2 py-1 flex items-center justify-between flex-shrink-0">
        {/* Left side: Terminal selector and swap button */}
        <div className="flex items-center gap-2">
          {/* Terminal Dropdown */}
          <div className="relative dropdown-container">
            <button
              onClick={onDropdownToggle}
              className="px-2 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-2 text-gray-200"
            >
              <div className={`w-2 h-2 rounded-full ${getStateColor(terminal?.aiState)}`}></div>
              <span>{terminal?.tabName || 'Select Terminal'}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {showDropdown && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded shadow-lg z-50">
                {terminals.map(t => (
                  <button
                    key={t.dbSessionId}
                    onClick={() => {
                      onTerminalSelect(t.dbSessionId);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${
                      t.dbSessionId === terminal?.dbSessionId ? 'bg-gray-700 text-gray-200' : 'text-gray-300'
                    }`}
                    disabled={terminalsInUse.includes(t.dbSessionId)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getStateColor(t.aiState)}`}></div>
                      <span className="truncate flex-1">{t.tabName}</span>
                      {terminalsInUse.includes(t.dbSessionId) && (
                        <span className="text-xs text-gray-500">(in use)</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Swap Button - only show in split view */}
          {onSwap && (
            <button
              onClick={onSwap}
              className="p-1 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-gray-200"
              title="Swap terminals"
            >
              <ArrowLeftRight className="w-3 h-3" />
            </button>
          )}
        </div>
        
        {/* Right side: Control buttons when this pane is in the "control position" */}
        {showControls && controlButtons ? (
          <div className="flex items-center gap-2">
            {controlButtons}
          </div>
        ) : (
          // Spacer to keep header height consistent
          <div className="w-0" />
        )}
      </div>
      
      {/* Terminal Content */}
      <div className="flex-1 relative overflow-hidden" style={{ contain: 'layout size' }}>
        {terminal && (
          <ThrottledTerminal
            key={terminal.dbSessionId}
            ref={ref}
            taskId={taskId}
            dbSessionId={terminal.dbSessionId}
            shelltenderSessionId={terminal.shelltenderSessionId || terminal.sessionId}
            worktreePath={worktreePath}
            isVisible={isVisible}
            hasFocus={hasFocus}
            onSessionStatus={onSessionStatus}
            onFocusRequest={onFocusRequest}
          />
        )}
      </div>
    </div>
  );
});

TerminalPane.displayName = 'TerminalPane';