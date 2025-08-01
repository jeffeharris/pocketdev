import { useRef, useEffect, useState, useCallback } from 'react';
import type { DirectTerminalHandle } from './DirectTerminal';
import { TerminalPane } from './TerminalPane';
import { useSplitViewStore, useSplitLayout, useLayoutState, saveLayout, useCurrentTaskId } from '../../stores/splitViewStore';
import { useTaskTerminals, useFocusedTerminalId, useTerminalStore } from '../../stores/terminalStore';
import type { TerminalSession } from '../../types/task';
import type { Task } from '../../types/task';

interface SplitViewContainerProps {
  taskId: string;
  projectId?: string;
  worktreePath: string;
  isVisible: boolean;
  onSessionStatus: (dbSessionId: string, status: 'connected' | 'disconnected' | 'error') => void;
  activeTabId: string;
  controlButtons?: React.ReactNode;
  isResetting?: boolean;
  setIsResetting?: (value: boolean) => void;
}

export function SplitViewContainer({
  taskId,
  projectId,
  worktreePath,
  isVisible,
  onSessionStatus,
  activeTabId,
  controlButtons,
  isResetting,
  setIsResetting
}: SplitViewContainerProps) {
  const layout = useSplitLayout();
  const layoutState = useLayoutState();
  const currentTaskId = useCurrentTaskId();
  const { setSplitRatio, setResizing, setPrimaryTerminal, setSecondaryTerminal, setTertiaryTerminal, setQuaternaryTerminal, updateLayout, swapPanes } = useSplitViewStore();
  const terminals = useTaskTerminals(taskId);
  const focusedTerminalId = useFocusedTerminalId(taskId);
  const { setFocusedTerminal } = useTerminalStore();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<DirectTerminalHandle>(null);
  const secondaryRef = useRef<DirectTerminalHandle>(null);
  const tertiaryRef = useRef<DirectTerminalHandle>(null);
  const quaternaryRef = useRef<DirectTerminalHandle>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const rafRef = useRef<number | null>(null);
  const [showPrimaryDropdown, setShowPrimaryDropdown] = useState(false);
  const [showSecondaryDropdown, setShowSecondaryDropdown] = useState(false);
  const [showTertiaryDropdown, setShowTertiaryDropdown] = useState(false);
  const [showQuaternaryDropdown, setShowQuaternaryDropdown] = useState(false);
  
  // Handle refresh button click when control buttons include refresh
  const handleRefreshClick = useCallback(() => {
    if (!isResetting && setIsResetting) {
      setIsResetting(true);
      
      // Refresh all terminals in the split view
      if (layout.mode === 'split-4') {
        // Refresh all quad view terminals
        if (primaryRef.current?.refresh) {
          primaryRef.current.refresh();
        }
        if (secondaryRef.current?.refresh) {
          secondaryRef.current.refresh();
        }
        if (tertiaryRef.current?.refresh) {
          tertiaryRef.current.refresh();
        }
        if (quaternaryRef.current?.refresh) {
          quaternaryRef.current.refresh();
        }
      } else if (layout.mode === 'split') {
        // Refresh both split view terminals
        if (primaryRef.current?.refresh) {
          primaryRef.current.refresh();
        }
        if (secondaryRef.current?.refresh) {
          secondaryRef.current.refresh();
        }
      }
      
      // Reset the flag after a delay
      setTimeout(() => {
        if (setIsResetting) setIsResetting(false);
      }, 1000);
    }
  }, [layout.mode, isResetting, setIsResetting]);
  
  // Listen for refresh button clicks on the control buttons
  useEffect(() => {
    if (controlButtons) {
      const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        // Check if the refresh button was clicked
        const refreshButton = target.closest('[data-action="refresh"]');
        if (refreshButton) {
          e.preventDefault();
          e.stopPropagation();
          handleRefreshClick();
        }
      };
      
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [controlButtons, handleRefreshClick]);
  
  // Helper to get AI state color
  const getStateColor = (state?: string) => {
    switch (state) {
      case 'waiting':
        return 'bg-purple-400';
      case 'working':
        return 'bg-yellow-400';
      case 'idle':
        return 'bg-blue-400';
      default:
        return 'bg-gray-500';
    }
  };
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setShowPrimaryDropdown(false);
        setShowSecondaryDropdown(false);
        setShowTertiaryDropdown(false);
        setShowQuaternaryDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Auto-assignment: assign available terminals when switching to split mode or terminals change
  useEffect(() => {
    // Only run when in split mode and layout is loaded and we're viewing the correct task
    if (layoutState !== 'loaded' || currentTaskId !== taskId || (layout.mode !== 'split' && layout.mode !== 'split-4')) {
      return;
    }
    
    const terminalIds = terminals.map(t => t.dbSessionId);
    
    // First, clear any stale terminal assignments that don't exist anymore
    if (layout.primaryTerminalId && !terminalIds.includes(layout.primaryTerminalId)) {
      setPrimaryTerminal( null);
    }
    if (layout.secondaryTerminalId && !terminalIds.includes(layout.secondaryTerminalId)) {
      setSecondaryTerminal( null);
    }
    if (layout.tertiaryTerminalId && !terminalIds.includes(layout.tertiaryTerminalId)) {
      setTertiaryTerminal( null);
    }
    if (layout.quaternaryTerminalId && !terminalIds.includes(layout.quaternaryTerminalId)) {
      setQuaternaryTerminal( null);
    }
    
    // Check if we need to do any assignments
    // Important: Only assign if we have enough unique terminals
    const needsPrimaryAssignment = terminalIds[0] && !layout.primaryTerminalId;
    const needsSecondaryAssignment = terminalIds.length >= 2 && terminalIds[1] && !layout.secondaryTerminalId && (layout.mode === 'split' || layout.mode === 'split-4');
    const needsTertiaryAssignment = terminalIds.length >= 3 && terminalIds[2] && !layout.tertiaryTerminalId && layout.mode === 'split-4';
    const needsQuaternaryAssignment = terminalIds.length >= 4 && terminalIds[3] && !layout.quaternaryTerminalId && layout.mode === 'split-4';
    
    // Only update if something actually needs assignment
    if (needsPrimaryAssignment) {
      setPrimaryTerminal( terminalIds[0]);
    }
    
    if (needsSecondaryAssignment) {
      setSecondaryTerminal( terminalIds[1]);
    }
    
    if (layout.mode === 'split-4') {
      if (needsTertiaryAssignment) {
        setTertiaryTerminal( terminalIds[2]);
      }
      if (needsQuaternaryAssignment) {
        setQuaternaryTerminal( terminalIds[3]);
      }
    }
    
    // Clean up terminals that shouldn't be assigned
    if (layout.mode === 'split') {
      // In 2-way split, clear tertiary and quaternary if set
      if (layout.tertiaryTerminalId) {
        setTertiaryTerminal( null);
      }
      if (layout.quaternaryTerminalId) {
        setQuaternaryTerminal( null);
      }
    }
  }, [
    // Only depend on mode changes and terminal list changes
    layout.mode,
    terminals.length, // Use length instead of full array to avoid unnecessary rerenders
    layoutState,
    currentTaskId,
    taskId,
    // Include the terminal IDs to detect stale assignments
    layout.primaryTerminalId,
    layout.secondaryTerminalId,
    layout.tertiaryTerminalId,
    layout.quaternaryTerminalId,
    setPrimaryTerminal,
    setSecondaryTerminal,
    setTertiaryTerminal,
    setQuaternaryTerminal
  ]);

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setResizing(true);
  }, [setResizing]);

  // Handle double-click to reset to 50/50
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setSplitRatio(0.5);
    saveLayout();
  }, [setSplitRatio]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Cancel any pending animation frame
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      
      // Schedule update on next animation frame
      rafRef.current = requestAnimationFrame(() => {
        if (!containerRef.current) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        let newRatio: number;
        
        if (layout.orientation === 'vertical') {
          newRatio = (e.clientX - rect.left) / rect.width;
        } else {
          newRatio = (e.clientY - rect.top) / rect.height;
        }
        
        // Clamp between 0.1 and 0.9
        newRatio = Math.max(0.1, Math.min(0.9, newRatio));
        setSplitRatio( newRatio);
      });
    };

    const handleMouseUp = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setIsDragging(false);
      setResizing(false);
      // Save layout after resize is complete
      saveLayout();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, layout.orientation, setSplitRatio, setResizing]);

  // Get the terminal instances
  const primaryTerminal = terminals.find(t => t.dbSessionId === layout.primaryTerminalId);
  const secondaryTerminal = terminals.find(t => t.dbSessionId === layout.secondaryTerminalId);
  const tertiaryTerminal = terminals.find(t => t.dbSessionId === layout.tertiaryTerminalId);
  const quaternaryTerminal = terminals.find(t => t.dbSessionId === layout.quaternaryTerminalId);

  // If in tab mode, we don't render anything here - the TerminalPanel handles it
  if (layout.mode === 'tab') {
    return null;
  }
  
  // Special case: no terminals at all
  if (terminals.length === 0) {
    const isHorizontal = layout.orientation === 'horizontal';
    return (
      <div 
        className="w-full h-full"
        style={{
          display: 'grid',
          gridTemplateColumns: !isHorizontal ? '1fr 1fr' : '1fr',
          gridTemplateRows: isHorizontal ? '1fr 1fr' : '1fr',
          gap: '1px',
          backgroundColor: '#1f2937',
          height: '100%',
          width: '100%'
        }}
      >
        {/* Both panes show add terminal */}
        <div className="flex items-center justify-center bg-gray-900">
          <button
            onClick={() => document.dispatchEvent(new CustomEvent('terminal-new-tab'))}
            className="text-gray-400 hover:text-gray-200 px-4 py-2 border border-gray-600 rounded hover:border-gray-400 transition-colors"
          >
            + Add Terminal
          </button>
        </div>
        <div className="flex items-center justify-center bg-gray-900">
          <button
            onClick={() => document.dispatchEvent(new CustomEvent('terminal-new-tab'))}
            className="text-gray-400 hover:text-gray-200 px-4 py-2 border border-gray-600 rounded hover:border-gray-400 transition-colors"
          >
            + Add Terminal
          </button>
        </div>
      </div>
    );
  }

  // Handle quad view (split-4)
  if (layout.mode === 'split-4') {
    
    return (
      <div 
        ref={containerRef}
        className="w-full h-full"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: '1px',
          backgroundColor: '#1f2937', // gray-800 for gap color
          height: '100%',
          width: '100%'
        }}
      >
        {/* Top-left quadrant (Primary) */}
        {primaryTerminal ? (
          <TerminalPane
            ref={primaryRef}
            terminal={primaryTerminal}
            terminals={terminals}
            taskId={taskId}
            worktreePath={worktreePath}
            isVisible={isVisible}
            hasFocus={focusedTerminalId === primaryTerminal.dbSessionId}
            showControls={false}
            controlButtons={controlButtons}
            showDropdown={showPrimaryDropdown}
            onDropdownToggle={() => setShowPrimaryDropdown(!showPrimaryDropdown)}
            onTerminalSelect={(terminalId) => {
              setPrimaryTerminal( terminalId);
              setShowPrimaryDropdown(false);
              setFocusedTerminal(taskId, terminalId);
            }}
            onSessionStatus={(status) => onSessionStatus(primaryTerminal.dbSessionId, status)}
            onFocusRequest={() => setFocusedTerminal(taskId, primaryTerminal.dbSessionId)}
            position="primary"
            getStateColor={getStateColor}
          />
        ) : (
          <div className="flex items-center justify-center bg-gray-900">
            <button
              onClick={() => document.dispatchEvent(new CustomEvent('terminal-new-tab'))}
              className="text-gray-400 hover:text-gray-200 px-4 py-2 border border-gray-600 rounded hover:border-gray-400 transition-colors"
            >
              + Add Terminal
            </button>
          </div>
        )}
        
        {/* Top-right quadrant (Secondary) - contains control buttons */}
        {secondaryTerminal ? (
          <TerminalPane
            ref={secondaryRef}
            terminal={secondaryTerminal}
            terminals={terminals}
            taskId={taskId}
            worktreePath={worktreePath}
            isVisible={isVisible}
            hasFocus={focusedTerminalId === secondaryTerminal.dbSessionId}
            showControls={true} // Show controls in top-right
            controlButtons={controlButtons}
            showDropdown={showSecondaryDropdown}
            onDropdownToggle={() => setShowSecondaryDropdown(!showSecondaryDropdown)}
            onTerminalSelect={(terminalId) => {
              setSecondaryTerminal( terminalId);
              setShowSecondaryDropdown(false);
              setFocusedTerminal(taskId, terminalId);
            }}
            onSessionStatus={(status) => onSessionStatus(secondaryTerminal.dbSessionId, status)}
            onFocusRequest={() => setFocusedTerminal(taskId, secondaryTerminal.dbSessionId)}
            position="secondary"
            getStateColor={getStateColor}
          />
        ) : (
          <div className="relative flex items-center justify-center bg-gray-900">
            {/* Control buttons at top of empty pane */}
            <div className="absolute top-2 right-2">
              <div className="flex items-center gap-2">
                {controlButtons}
              </div>
            </div>
            <button
              onClick={() => document.dispatchEvent(new CustomEvent('terminal-new-tab'))}
              className="text-gray-400 hover:text-gray-200 px-4 py-2 border border-gray-600 rounded hover:border-gray-400 transition-colors"
            >
              + Add Terminal
            </button>
          </div>
        )}
        
        {/* Bottom-left quadrant (Tertiary) */}
        {tertiaryTerminal ? (
          <TerminalPane
            ref={tertiaryRef}
            terminal={tertiaryTerminal}
            terminals={terminals}
            taskId={taskId}
            worktreePath={worktreePath}
            isVisible={isVisible}
            hasFocus={focusedTerminalId === tertiaryTerminal.dbSessionId}
            showControls={false}
            controlButtons={controlButtons}
            showDropdown={showTertiaryDropdown}
            onDropdownToggle={() => setShowTertiaryDropdown(!showTertiaryDropdown)}
            onTerminalSelect={(terminalId) => {
              setTertiaryTerminal( terminalId);
              setShowTertiaryDropdown(false);
              setFocusedTerminal(taskId, terminalId);
            }}
            onSessionStatus={(status) => onSessionStatus(tertiaryTerminal.dbSessionId, status)}
            onFocusRequest={() => setFocusedTerminal(taskId, tertiaryTerminal.dbSessionId)}
            position="tertiary"
            getStateColor={getStateColor}
          />
        ) : (
          <div className="flex items-center justify-center bg-gray-900">
            <button
              onClick={() => document.dispatchEvent(new CustomEvent('terminal-new-tab'))}
              className="text-gray-400 hover:text-gray-200 px-4 py-2 border border-gray-600 rounded hover:border-gray-400 transition-colors"
            >
              + Add Terminal
            </button>
          </div>
        )}
        
        {/* Bottom-right quadrant (Quaternary) - might be empty */}
        {quaternaryTerminal ? (
          <TerminalPane
            ref={quaternaryRef}
            terminal={quaternaryTerminal}
            terminals={terminals}
            taskId={taskId}
            worktreePath={worktreePath}
            isVisible={isVisible}
            hasFocus={focusedTerminalId === quaternaryTerminal.dbSessionId}
            showControls={false}
            controlButtons={controlButtons}
            showDropdown={showQuaternaryDropdown}
            onDropdownToggle={() => setShowQuaternaryDropdown(!showQuaternaryDropdown)}
            onTerminalSelect={(terminalId) => {
              setQuaternaryTerminal( terminalId);
              setShowQuaternaryDropdown(false);
              setFocusedTerminal(taskId, terminalId);
            }}
            onSessionStatus={(status) => onSessionStatus(quaternaryTerminal.dbSessionId, status)}
            onFocusRequest={() => setFocusedTerminal(taskId, quaternaryTerminal.dbSessionId)}
            position="quaternary"
            getStateColor={getStateColor}
          />
        ) : (
          <div className="flex items-center justify-center bg-gray-900">
            <button
              onClick={() => {
                // This will trigger the tab add in TerminalPanel
                document.dispatchEvent(new CustomEvent('terminal-new-tab'));
              }}
              className="text-gray-400 hover:text-gray-200 px-4 py-2 border border-gray-600 rounded hover:border-gray-400 transition-colors"
            >
              + Add Terminal
            </button>
          </div>
        )}
      </div>
    );
  }

  // Calculate styles based on orientation for 2-way split
  const isHorizontal = layout.orientation === 'horizontal';

  return (
    <div 
      ref={containerRef}
      className={`w-full h-full relative ${isDragging ? 'select-none' : ''}`}
      style={{
        display: 'grid',
        gridTemplateColumns: !isHorizontal ? `${layout.splitRatio}fr ${1 - layout.splitRatio}fr` : '1fr',
        gridTemplateRows: isHorizontal ? `${layout.splitRatio}fr ${1 - layout.splitRatio}fr` : '1fr',
        gap: '0px', // Gap handled by resizer
        height: '100%',
        width: '100%',
        // Disable transitions during dragging for smoother resize
        transition: isDragging ? 'none' : undefined
      }}
    >
      {/* Primary Pane (left in vertical, top in horizontal) */}
      {primaryTerminal ? (
        <TerminalPane
          ref={primaryRef}
          terminal={primaryTerminal}
          terminals={terminals}
          taskId={taskId}
          worktreePath={worktreePath}
          isVisible={isVisible}
          hasFocus={focusedTerminalId === primaryTerminal?.dbSessionId}
          showControls={isHorizontal} // Show controls in top pane for horizontal split
          controlButtons={controlButtons}
          showDropdown={showPrimaryDropdown}
          onDropdownToggle={() => setShowPrimaryDropdown(!showPrimaryDropdown)}
          onTerminalSelect={(terminalId) => {
            setPrimaryTerminal( terminalId);
            setShowPrimaryDropdown(false);
            setFocusedTerminal(taskId, terminalId);
          }}
          onSessionStatus={(status) => primaryTerminal && onSessionStatus(primaryTerminal.dbSessionId, status)}
          onFocusRequest={() => primaryTerminal && setFocusedTerminal(taskId, primaryTerminal.dbSessionId)}
          onSwap={() => swapPanes()}
          position="primary"
          getStateColor={getStateColor}
        />
      ) : (
        <div className="flex items-center justify-center bg-gray-900">
          <button
            onClick={() => document.dispatchEvent(new CustomEvent('terminal-new-tab'))}
            className="text-gray-400 hover:text-gray-200 px-4 py-2 border border-gray-600 rounded hover:border-gray-400 transition-colors"
          >
            + Add Terminal
          </button>
        </div>
      )}

      {/* Resizer - only show when both terminals are present */}
      {primaryTerminal && secondaryTerminal && (
        <div
          ref={resizerRef}
          className={`
            absolute ${!isHorizontal ? 'cursor-col-resize' : 'cursor-row-resize'}
            ${isDragging ? 'bg-blue-500' : 'bg-transparent hover:bg-blue-500/50'}
            transition-colors z-10
          `}
          style={{
            ...(!isHorizontal ? {
              left: `calc(${layout.splitRatio * 100}% - 2px)`,
              top: 0,
              width: '4px',
              height: '100%'
            } : {
              top: `calc(${layout.splitRatio * 100}% - 2px)`,
              left: 0,
              height: '4px', 
              width: '100%'
            })
          }}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          title="Drag to resize, double-click to reset to 50/50"
        />
      )}

      {/* Secondary Pane (right in vertical, bottom in horizontal) */}
      {secondaryTerminal ? (
        <TerminalPane
          ref={secondaryRef}
          terminal={secondaryTerminal}
          terminals={terminals}
          taskId={taskId}
          worktreePath={worktreePath}
          isVisible={isVisible}
          hasFocus={focusedTerminalId === secondaryTerminal?.dbSessionId}
          showControls={!isHorizontal} // Show controls in right pane for vertical split
          controlButtons={controlButtons}
          showDropdown={showSecondaryDropdown}
          onDropdownToggle={() => setShowSecondaryDropdown(!showSecondaryDropdown)}
          onTerminalSelect={(terminalId) => {
            setSecondaryTerminal( terminalId);
            setShowSecondaryDropdown(false);
            setFocusedTerminal(taskId, terminalId);
          }}
          onSessionStatus={(status) => secondaryTerminal && onSessionStatus(secondaryTerminal.dbSessionId, status)}
          onFocusRequest={() => secondaryTerminal && setFocusedTerminal(taskId, secondaryTerminal.dbSessionId)}
          onSwap={() => swapPanes()}
          position="secondary"
          getStateColor={getStateColor}
        />
      ) : (
        <div className="flex items-center justify-center bg-gray-900">
          <button
            onClick={() => document.dispatchEvent(new CustomEvent('terminal-new-tab'))}
            className="text-gray-400 hover:text-gray-200 px-4 py-2 border border-gray-600 rounded hover:border-gray-400 transition-colors"
          >
            + Add Terminal
          </button>
        </div>
      )}
    </div>
  );
}