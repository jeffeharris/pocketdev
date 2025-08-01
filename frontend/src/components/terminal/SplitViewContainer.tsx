import { useRef, useEffect, useState, useCallback } from 'react';
import { ChevronDown, ArrowLeftRight } from 'lucide-react';
import { useSplitViewStore, useSplitLayout, useLayoutState, saveLayout } from '../../stores/splitViewStore';
import { useTaskTerminals, useFocusedTerminalId, useTerminalStore } from '../../stores/terminalStore';
import type { TerminalSession } from '../../types/task';

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
  const { setSplitRatio, setResizing, setPrimaryTerminal, setSecondaryTerminal, setTertiaryTerminal, setQuaternaryTerminal, updateLayout, swapPanes } = useSplitViewStore();
  const terminals = useTaskTerminals(taskId);
  const focusedTerminalId = useFocusedTerminalId(taskId);
  const { setFocusedTerminal } = useTerminalStore();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const rafRef = useRef<number | null>(null);
  const [showPrimaryDropdown, setShowPrimaryDropdown] = useState(false);
  const [showSecondaryDropdown, setShowSecondaryDropdown] = useState(false);
  const [showTertiaryDropdown, setShowTertiaryDropdown] = useState(false);
  const [showQuaternaryDropdown, setShowQuaternaryDropdown] = useState(false);

  // Get the terminal instances - use explicit assignments or fall back to order
  const primaryTerminal = layout.primaryTerminalId 
    ? terminals.find(t => t.dbSessionId === layout.primaryTerminalId)
    : terminals[0];
  const secondaryTerminal = layout.secondaryTerminalId 
    ? terminals.find(t => t.dbSessionId === layout.secondaryTerminalId)
    : terminals[1];
  const tertiaryTerminal = layout.tertiaryTerminalId 
    ? terminals.find(t => t.dbSessionId === layout.tertiaryTerminalId)
    : terminals[2];
  const quaternaryTerminal = layout.quaternaryTerminalId 
    ? terminals.find(t => t.dbSessionId === layout.quaternaryTerminalId)
    : terminals[3];

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
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

  // Auto-assign terminals if slots are empty
  useEffect(() => {
    if (terminals.length === 0) return;

    if (layout.mode === 'split') {
      if (!layout.primaryTerminalId && terminals.length > 0) {
        setPrimaryTerminal(taskId, terminals[0].dbSessionId);
      }
      if (!layout.secondaryTerminalId && terminals.length > 1) {
        setSecondaryTerminal(taskId, terminals[1].dbSessionId);
      }
    } else if (layout.mode === 'split-4') {
      if (!layout.primaryTerminalId && terminals.length > 0) {
        setPrimaryTerminal(taskId, terminals[0].dbSessionId);
      }
      if (!layout.secondaryTerminalId && terminals.length > 1) {
        setSecondaryTerminal(taskId, terminals[1].dbSessionId);
      }
      if (!layout.tertiaryTerminalId && terminals.length > 2) {
        setTertiaryTerminal(taskId, terminals[2].dbSessionId);
      }
      if (!layout.quaternaryTerminalId && terminals.length > 3) {
        setQuaternaryTerminal(taskId, terminals[3].dbSessionId);
      }
    }
  }, [terminals, layout.mode, layout.primaryTerminalId, layout.secondaryTerminalId, layout.tertiaryTerminalId, layout.quaternaryTerminalId, taskId, setPrimaryTerminal, setSecondaryTerminal, setTertiaryTerminal, setQuaternaryTerminal]);

  const handleSwapPanes = useCallback(() => {
    swapPanes(taskId);
  }, [taskId, swapPanes]);

  const handleDoubleClick = useCallback(() => {
    setSplitRatio(50);
    saveLayout();
  }, [setSplitRatio]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setResizing(true);
    
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging && e.buttons !== 1) return;
      
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      
      rafRef.current = requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect();
        const isHorizontal = layout.orientation === 'horizontal';
        
        let percentage: number;
        if (isHorizontal) {
          percentage = ((e.clientY - rect.top) / rect.height) * 100;
        } else {
          percentage = ((e.clientX - rect.left) / rect.width) * 100;
        }
        
        percentage = Math.max(20, Math.min(80, percentage));
        setSplitRatio(percentage);
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      saveLayout();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isDragging, layout.orientation, setSplitRatio, setResizing]);

  // Helper to render terminal dropdown
  const renderTerminalDropdown = (
    terminal: TerminalSession | undefined,
    showDropdown: boolean,
    onToggle: () => void,
    onSelect: (terminalId: string) => void,
    position: 'primary' | 'secondary' | 'tertiary' | 'quaternary'
  ) => {
    const getStateColor = (state?: string) => {
      switch (state) {
        case 'idle':
        case 'ready':
          return 'bg-green-500';
        case 'working':
        case 'thinking':
          return 'bg-yellow-500';
        case 'waiting':
          return 'bg-blue-500';
        case 'error':
          return 'bg-red-500';
        default:
          return 'bg-gray-500';
      }
    };

    return (
      <div className="absolute top-2 left-2 z-50 dropdown-container">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300 hover:text-white transition-colors"
        >
          <div className={`w-2 h-2 rounded-full ${getStateColor(terminal?.state)}`} />
          <span className="max-w-[150px] truncate">
            {terminal ? terminal.name : 'Select Terminal'}
          </span>
          <ChevronDown className="w-3 h-3" />
        </button>
        
        {showDropdown && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded shadow-lg overflow-hidden">
            {terminals.map(t => (
              <button
                key={t.dbSessionId}
                onClick={() => {
                  onSelect(t.dbSessionId);
                  onToggle();
                }}
                className={`w-full text-left px-3 py-2 hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                  t.dbSessionId === terminal?.dbSessionId ? 'bg-gray-700' : ''
                }`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStateColor(t.state)}`} />
                <span className="text-sm text-gray-300 truncate">{t.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Don't render anything in tab mode
  if (layout.mode === 'tab') {
    return null;
  }

  // Render controls overlay for split and quad modes
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Quad View Controls */}
      {layout.mode === 'split-4' && (
        <>
          {/* Terminal selection dropdowns */}
          <div className="pointer-events-auto">
            {/* Primary (top-left) dropdown */}
            <div className="absolute top-0 left-0 w-1/2 h-1/2">
              {renderTerminalDropdown(
                primaryTerminal,
                showPrimaryDropdown,
                () => setShowPrimaryDropdown(!showPrimaryDropdown),
                (terminalId) => {
                  setPrimaryTerminal(taskId, terminalId);
                  setShowPrimaryDropdown(false);
                },
                'primary'
              )}
            </div>

            {/* Secondary (top-right) dropdown with control buttons */}
            <div className="absolute top-0 right-0 w-1/2 h-1/2">
              {renderTerminalDropdown(
                secondaryTerminal,
                showSecondaryDropdown,
                () => setShowSecondaryDropdown(!showSecondaryDropdown),
                (terminalId) => {
                  setSecondaryTerminal(taskId, terminalId);
                  setShowSecondaryDropdown(false);
                },
                'secondary'
              )}
              {controlButtons && (
                <div className="absolute top-2 right-2">
                  {controlButtons}
                </div>
              )}
            </div>

            {/* Tertiary (bottom-left) dropdown */}
            <div className="absolute bottom-0 left-0 w-1/2 h-1/2">
              {renderTerminalDropdown(
                tertiaryTerminal,
                showTertiaryDropdown,
                () => setShowTertiaryDropdown(!showTertiaryDropdown),
                (terminalId) => {
                  setTertiaryTerminal(taskId, terminalId);
                  setShowTertiaryDropdown(false);
                },
                'tertiary'
              )}
            </div>

            {/* Quaternary (bottom-right) dropdown */}
            <div className="absolute bottom-0 right-0 w-1/2 h-1/2">
              {renderTerminalDropdown(
                quaternaryTerminal,
                showQuaternaryDropdown,
                () => setShowQuaternaryDropdown(!showQuaternaryDropdown),
                (terminalId) => {
                  setQuaternaryTerminal(taskId, terminalId);
                  setShowQuaternaryDropdown(false);
                },
                'quaternary'
              )}
            </div>
          </div>

          {/* Grid dividers */}
          <div className="pointer-events-auto">
            <div className="absolute top-0 left-1/2 w-px h-full bg-gray-700 -translate-x-1/2" />
            <div className="absolute left-0 top-1/2 w-full h-px bg-gray-700 -translate-y-1/2" />
          </div>
        </>
      )}

      {/* Split View Controls */}
      {layout.mode === 'split' && (
        <>
          <div 
            ref={containerRef}
            className="absolute inset-0"
            style={{
              display: 'grid',
              gridTemplateColumns: layout.orientation === 'vertical' ? `${layout.splitRatio}% ${100 - layout.splitRatio}%` : '1fr',
              gridTemplateRows: layout.orientation === 'horizontal' ? `${layout.splitRatio}% ${100 - layout.splitRatio}%` : '1fr',
            }}
          >
            {/* Primary pane controls */}
            <div className="relative pointer-events-auto">
              {renderTerminalDropdown(
                primaryTerminal,
                showPrimaryDropdown,
                () => setShowPrimaryDropdown(!showPrimaryDropdown),
                (terminalId) => {
                  setPrimaryTerminal(taskId, terminalId);
                  setShowPrimaryDropdown(false);
                },
                'primary'
              )}
            </div>

            {/* Secondary pane controls */}
            <div className="relative pointer-events-auto">
              {renderTerminalDropdown(
                secondaryTerminal,
                showSecondaryDropdown,
                () => setShowSecondaryDropdown(!showSecondaryDropdown),
                (terminalId) => {
                  setSecondaryTerminal(taskId, terminalId);
                  setShowSecondaryDropdown(false);
                },
                'secondary'
              )}
              {controlButtons && (
                <div className="absolute top-2 right-2">
                  {controlButtons}
                </div>
              )}
            </div>
          </div>

          {/* Resizer */}
          <div
            ref={resizerRef}
            className={`absolute bg-gray-700 hover:bg-blue-500 transition-colors cursor-${layout.orientation === 'vertical' ? 'col' : 'row'}-resize pointer-events-auto group`}
            style={layout.orientation === 'vertical' ? {
              left: `${layout.splitRatio}%`,
              top: 0,
              bottom: 0,
              width: '1px',
              transform: 'translateX(-50%)',
            } : {
              top: `${layout.splitRatio}%`,
              left: 0,
              right: 0,
              height: '1px',
              transform: 'translateY(-50%)',
            }}
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
          >
            {/* Swap button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSwapPanes();
              }}
              className={`absolute ${
                layout.orientation === 'vertical' 
                  ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' 
                  : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
              } opacity-0 group-hover:opacity-100 transition-opacity bg-blue-500 hover:bg-blue-600 text-white p-1 rounded`}
              title="Swap panes"
            >
              <ArrowLeftRight className="w-3 h-3" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}