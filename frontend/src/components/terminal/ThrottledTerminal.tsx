import { forwardRef, useRef, useEffect, useState, useImperativeHandle } from 'react';
import { DirectTerminal, type DirectTerminalHandle } from './DirectTerminal';
import { useIsResizing } from '../../stores/splitViewStore';

interface ThrottledTerminalProps {
  taskId: string;
  dbSessionId: string;
  shelltenderSessionId: string;
  worktreePath: string;
  isVisible: boolean;
  hasFocus: boolean;
  onSessionStatus: (status: 'connected' | 'disconnected' | 'error') => void;
  onFocusRequest: () => void;
}

// Throttled terminal that delays resize operations for unfocused terminals
export const ThrottledTerminal = forwardRef<DirectTerminalHandle, ThrottledTerminalProps>(({
  taskId,
  dbSessionId,
  shelltenderSessionId,
  worktreePath,
  isVisible,
  hasFocus,
  onSessionStatus,
  onFocusRequest
}, ref) => {
  const terminalRef = useRef<DirectTerminalHandle>(null);
  const isResizing = useIsResizing();
  const [shouldRender, setShouldRender] = useState(true);
  const resizeTimeoutRef = useRef<NodeJS.Timeout>();
  const hasBeenVisibleRef = useRef(false);
  
  // Expose the same interface as DirectTerminal
  useImperativeHandle(ref, () => ({
    focus: () => terminalRef.current?.focus(),
    fit: () => terminalRef.current?.fit(),
    refresh: () => terminalRef.current?.refresh()
  }), []);
  
  // Handle resize throttling for unfocused terminals
  useEffect(() => {
    // Only hide terminals that have been visible before (not on initial mount)
    if (!hasFocus && isResizing && hasBeenVisibleRef.current) {
      // Hide unfocused terminal during resize for performance
      setShouldRender(false);
      
      // Clear any existing timeout
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      
      // Re-render and fit after resize stops
      resizeTimeoutRef.current = setTimeout(() => {
        setShouldRender(true);
        // Fit terminal after it's visible again
        setTimeout(() => {
          terminalRef.current?.fit();
        }, 50);
      }, 300); // Wait 300ms after resize stops
    } else {
      // Always render focused terminals
      setShouldRender(true);
      if (shouldRender) {
        hasBeenVisibleRef.current = true;
      }
    }
    
    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [hasFocus, isResizing, shouldRender]);
  
  // Ensure terminal is shown when first mounted
  useEffect(() => {
    // Always show terminal initially
    setShouldRender(true);
  }, []);
  
  // Force fit when focus changes
  useEffect(() => {
    if (hasFocus && terminalRef.current) {
      setTimeout(() => {
        terminalRef.current?.fit();
      }, 50);
    }
  }, [hasFocus]);
  
  
  return (
    <div className="relative w-full h-full">
      {shouldRender ? (
        <DirectTerminal
          ref={terminalRef}
          taskId={taskId}
          dbSessionId={dbSessionId}
          shelltenderSessionId={shelltenderSessionId}
          worktreePath={worktreePath}
          isVisible={isVisible}
          hasFocus={hasFocus}
          onSessionStatus={onSessionStatus}
          onFocusRequest={onFocusRequest}
        />
      ) : (
        // Placeholder during resize
        <div className="w-full h-full bg-gray-900 border border-gray-600" />
      )}
    </div>
  );
});

ThrottledTerminal.displayName = 'ThrottledTerminal';