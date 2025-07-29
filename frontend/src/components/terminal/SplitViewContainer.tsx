import { useRef, useEffect, useState, useCallback } from 'react';
import { DirectTerminal, type DirectTerminalHandle } from './DirectTerminal';
import { useSplitViewStore, useSplitLayout, persistLayout } from '../../stores/splitViewStore';
import { useTaskTerminals } from '../../stores/terminalStore';
import type { TerminalSession } from '../../types/task';
import type { Task } from '../../types/task';

interface SplitViewContainerProps {
  taskId: string;
  projectId?: string;
  worktreePath: string;
  isVisible: boolean;
  onSessionStatus: (dbSessionId: string, status: 'connected' | 'disconnected' | 'error') => void;
  activeTabId: string;
}

export function SplitViewContainer({
  taskId,
  projectId,
  worktreePath,
  isVisible,
  onSessionStatus,
  activeTabId
}: SplitViewContainerProps) {
  const layout = useSplitLayout(taskId);
  const { setSplitRatio, setResizing, setPrimaryTerminal, setSecondaryTerminal } = useSplitViewStore();
  const terminals = useTaskTerminals(taskId);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<DirectTerminalHandle>(null);
  const secondaryRef = useRef<DirectTerminalHandle>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Persist layout changes with debounce
  useEffect(() => {
    if (!projectId) return;
    
    const timeoutId = setTimeout(() => {
      persistLayout(taskId, projectId);
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [layout, taskId, projectId]);

  // Auto-assign terminals to panes if not set
  useEffect(() => {
    if (layout.mode === 'split' && terminals.length > 0) {
      // If primary not set or doesn't exist, use active tab or first terminal
      if (!layout.primaryTerminalId || !terminals.find(t => t.dbSessionId === layout.primaryTerminalId)) {
        const primaryTerminal = terminals.find(t => t.dbSessionId === activeTabId) || terminals[0];
        setPrimaryTerminal(taskId, primaryTerminal.dbSessionId);
      }
      
      // If secondary not set or doesn't exist, use next available terminal
      if (!layout.secondaryTerminalId || !terminals.find(t => t.dbSessionId === layout.secondaryTerminalId)) {
        const secondaryTerminal = terminals.find(t => 
          t.dbSessionId !== layout.primaryTerminalId && t.dbSessionId !== activeTabId
        ) || terminals[1];
        
        if (secondaryTerminal) {
          setSecondaryTerminal(taskId, secondaryTerminal.dbSessionId);
        }
      }
    }
  }, [layout.mode, layout.primaryTerminalId, layout.secondaryTerminalId, terminals, taskId, activeTabId, setPrimaryTerminal, setSecondaryTerminal]);

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setResizing(true);
  }, [setResizing]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      let newRatio: number;
      
      if (layout.orientation === 'horizontal') {
        newRatio = (e.clientX - rect.left) / rect.width;
      } else {
        newRatio = (e.clientY - rect.top) / rect.height;
      }
      
      // Clamp between 0.1 and 0.9
      newRatio = Math.max(0.1, Math.min(0.9, newRatio));
      setSplitRatio(taskId, newRatio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, layout.orientation, taskId, setSplitRatio, setResizing]);

  // Get the terminal instances
  const primaryTerminal = terminals.find(t => t.dbSessionId === layout.primaryTerminalId);
  const secondaryTerminal = terminals.find(t => t.dbSessionId === layout.secondaryTerminalId);

  // If in tab mode or no terminals, render single view
  if (layout.mode === 'tab' || !primaryTerminal || terminals.length < 2) {
    const activeTerminal = terminals.find(t => t.dbSessionId === activeTabId);
    if (!activeTerminal) return null;
    
    return (
      <div className="w-full h-full">
        <DirectTerminal
          key={activeTerminal.dbSessionId}
          ref={primaryRef}
          taskId={taskId}
          dbSessionId={activeTerminal.dbSessionId}
          shelltenderSessionId={activeTerminal.shelltenderSessionId || activeTerminal.sessionId}
          worktreePath={worktreePath}
          isVisible={isVisible}
          onSessionStatus={(status) => onSessionStatus(activeTerminal.dbSessionId, status)}
        />
      </div>
    );
  }

  // Calculate styles based on orientation and ratio
  const isHorizontal = layout.orientation === 'horizontal';
  const primarySize = `${layout.splitRatio * 100}%`;
  const secondarySize = `${(1 - layout.splitRatio) * 100}%`;

  return (
    <div 
      ref={containerRef}
      className={`w-full h-full flex ${isHorizontal ? 'flex-row' : 'flex-col'}`}
    >
      {/* Primary Pane */}
      <div 
        className="relative overflow-hidden"
        style={{ 
          [isHorizontal ? 'width' : 'height']: primarySize,
          minWidth: isHorizontal ? '100px' : undefined,
          minHeight: !isHorizontal ? '100px' : undefined
        }}
      >
        {primaryTerminal && (
          <DirectTerminal
            key={primaryTerminal.dbSessionId}
            ref={primaryRef}
            taskId={taskId}
            dbSessionId={primaryTerminal.dbSessionId}
            shelltenderSessionId={primaryTerminal.shelltenderSessionId || primaryTerminal.sessionId}
            worktreePath={worktreePath}
            isVisible={isVisible}
            onSessionStatus={(status) => onSessionStatus(primaryTerminal.dbSessionId, status)}
          />
        )}
      </div>

      {/* Resizer */}
      <div
        ref={resizerRef}
        className={`
          ${isHorizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
          bg-gray-700 hover:bg-blue-500 transition-colors
          ${isDragging ? 'bg-blue-500' : ''}
          relative group
        `}
        onMouseDown={handleMouseDown}
      >
        {/* Hover indicator */}
        <div className={`
          absolute ${isHorizontal ? 'inset-y-0 -left-1 -right-1' : 'inset-x-0 -top-1 -bottom-1'}
          group-hover:bg-blue-500/20
        `} />
      </div>

      {/* Secondary Pane */}
      <div 
        className="relative overflow-hidden"
        style={{ 
          [isHorizontal ? 'width' : 'height']: secondarySize,
          minWidth: isHorizontal ? '100px' : undefined,
          minHeight: !isHorizontal ? '100px' : undefined
        }}
      >
        {secondaryTerminal && (
          <DirectTerminal
            key={secondaryTerminal.dbSessionId}
            ref={secondaryRef}
            taskId={taskId}
            dbSessionId={secondaryTerminal.dbSessionId}
            shelltenderSessionId={secondaryTerminal.shelltenderSessionId || secondaryTerminal.sessionId}
            worktreePath={worktreePath}
            isVisible={isVisible}
            onSessionStatus={(status) => onSessionStatus(secondaryTerminal.dbSessionId, status)}
          />
        )}
      </div>
    </div>
  );
}