import { useState, useRef, useEffect } from 'react';
import { 
  Columns, 
  Rows, 
  ArrowLeftRight,
  ChevronDown,
  Monitor
} from 'lucide-react';
import { useSplitViewStore, useSplitLayout, saveLayout } from '../../stores/splitViewStore';
import { useTaskTerminals } from '../../stores/terminalStore';
import type { TerminalSession } from '../../types/task';

interface SplitViewControlsProps {
  taskId: string;
  activeTabId: string;
  onTerminalSelect?: (dbSessionId: string) => void;
  onTerminalReorder?: (reorderedTerminals: TerminalSession[]) => void;
}

export function SplitViewControls({
  taskId,
  activeTabId,
  onTerminalSelect,
  onTerminalReorder
}: SplitViewControlsProps) {
  const layout = useSplitLayout();
  const terminals = useTaskTerminals(taskId);
  const { updateLayout } = useSplitViewStore();
  
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
  const [showPrimaryDropdown, setShowPrimaryDropdown] = useState(false);
  const [showSecondaryDropdown, setShowSecondaryDropdown] = useState(false);
  const primaryDropdownRef = useRef<HTMLDivElement>(null);
  const secondaryDropdownRef = useRef<HTMLDivElement>(null);
  
  // Auto-disable split view on mobile
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (primaryDropdownRef.current && !primaryDropdownRef.current.contains(event.target as Node)) {
        setShowPrimaryDropdown(false);
      }
      if (secondaryDropdownRef.current && !secondaryDropdownRef.current.contains(event.target as Node)) {
        setShowSecondaryDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get terminals by order (display is order-based)
  const primaryTerminal = terminals[0];
  const secondaryTerminal = terminals[1];

  // Only show controls if we have 2+ terminals and not on mobile
  if (terminals.length < 2 || isMobile) {
    return null;
  }

  return (
    <div className="flex items-center flex-1" data-split-view-controls>
      {/* Tab-style Terminal Selectors */}
      <div className="flex items-center">
        {/* Primary Terminal Tab */}
        <div className="relative" ref={primaryDropdownRef}>
          <button
            onClick={() => setShowPrimaryDropdown(!showPrimaryDropdown)}
            className={`px-3 py-2 text-sm border-r border-gray-600 relative transition-colors cursor-pointer flex items-center gap-2 ${
              primaryTerminal?.dbSessionId === activeTabId
                ? 'bg-gray-700 text-gray-200'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
            }`}
            title="Primary terminal"
          >
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="max-w-[120px] truncate">
              {primaryTerminal?.tabName || 'Select Terminal'}
            </span>
            <ChevronDown className="w-3 h-3" />
          </button>
              
              {showPrimaryDropdown && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded shadow-lg z-50">
                  {terminals.map(terminal => (
                    <button
                      key={terminal.dbSessionId}
                      onClick={() => {
                        // Swap the selected terminal to the primary position
                        if (onTerminalReorder) {
                          const selectedIndex = terminals.findIndex(t => t.dbSessionId === terminal.dbSessionId);
                          if (selectedIndex > 0) {
                            const newTerminals = [...terminals];
                            [newTerminals[0], newTerminals[selectedIndex]] = [newTerminals[selectedIndex], newTerminals[0]];
                            // Update tabOrder to match new positions
                            const reorderedTerminals = newTerminals.map((t, index) => ({
                              ...t,
                              tabOrder: index
                            }));
                            onTerminalReorder(reorderedTerminals);
                          }
                        }
                        setShowPrimaryDropdown(false);
                        if (onTerminalSelect) {
                          onTerminalSelect(terminal.dbSessionId);
                        }
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${
                        terminal === primaryTerminal ? 'bg-gray-700 text-gray-200' : 'text-gray-300'
                      }`}
                      disabled={terminal === secondaryTerminal}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getStateColor(terminal.aiState)}`}></div>
                        <span className="truncate flex-1">{terminal.tabName}</span>
                        {terminal === secondaryTerminal && (
                          <span className="text-xs text-gray-500">(in use)</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

        {/* Secondary Terminal Tab */}
        <div className="relative" ref={secondaryDropdownRef}>
          <button
            onClick={() => setShowSecondaryDropdown(!showSecondaryDropdown)}
            className={`px-3 py-2 text-sm border-r border-gray-600 relative transition-colors cursor-pointer flex items-center gap-2 ${
              secondaryTerminal?.dbSessionId === activeTabId
                ? 'bg-gray-700 text-gray-200'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
            }`}
            title="Secondary terminal"
          >
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="max-w-[120px] truncate">
              {secondaryTerminal?.tabName || 'Select Terminal'}
            </span>
            <ChevronDown className="w-3 h-3" />
          </button>
              
              {showSecondaryDropdown && (
                <div className="absolute top-full right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded shadow-lg z-50">
                  {terminals.map(terminal => (
                    <button
                      key={terminal.dbSessionId}
                      onClick={() => {
                        // Swap the selected terminal to the secondary position
                        if (onTerminalReorder) {
                          const selectedIndex = terminals.findIndex(t => t.dbSessionId === terminal.dbSessionId);
                          if (selectedIndex !== 1 && selectedIndex >= 0) {
                            const newTerminals = [...terminals];
                            [newTerminals[1], newTerminals[selectedIndex]] = [newTerminals[selectedIndex], newTerminals[1]];
                            // Update tabOrder to match new positions
                            const reorderedTerminals = newTerminals.map((t, index) => ({
                              ...t,
                              tabOrder: index
                            }));
                            onTerminalReorder(reorderedTerminals);
                          }
                        }
                        setShowSecondaryDropdown(false);
                        if (onTerminalSelect) {
                          onTerminalSelect(terminal.dbSessionId);
                        }
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${
                        terminal === secondaryTerminal ? 'bg-gray-700 text-gray-200' : 'text-gray-300'
                      }`}
                      disabled={terminal === primaryTerminal}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getStateColor(terminal.aiState)}`}></div>
                        <span className="truncate flex-1">{terminal.tabName}</span>
                        {terminal === primaryTerminal && (
                          <span className="text-xs text-gray-500">(in use)</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
      </div>

      {/* Split Controls */}
      <div className="flex items-center gap-2 ml-4">
        {/* Orientation Toggle */}
        <div className="flex items-center bg-gray-700 rounded text-xs">
          <button
            onClick={() => {
              updateLayout({ orientation: 'horizontal' });
              saveLayout();
            }}
            className={`p-1 rounded-l transition-colors ${
              layout.orientation === 'horizontal'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title="Horizontal split (top/bottom)"
          >
            <Rows className="w-3 h-3" />
          </button>
          <button
            onClick={() => {
              updateLayout({ orientation: 'vertical' });
              saveLayout();
            }}
            className={`p-1 rounded-r transition-colors ${
              layout.orientation === 'vertical'
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title="Vertical split (side by side)"
          >
            <Columns className="w-3 h-3" />
          </button>
        </div>

        {/* Swap Button */}
        <button
          onClick={() => {
            if (onTerminalReorder && terminals.length >= 2) {
              // Swap first two terminals
              const newTerminals = [...terminals];
              [newTerminals[0], newTerminals[1]] = [newTerminals[1], newTerminals[0]];
              // Update tabOrder to match new positions
              const reorderedTerminals = newTerminals.map((t, index) => ({
                ...t,
                tabOrder: index
              }));
              onTerminalReorder(reorderedTerminals);
            }
          }}
          className="p-1 bg-gray-700 rounded hover:bg-gray-600 transition-colors text-gray-400 hover:text-gray-200"
          title="Swap terminals"
        >
          <ArrowLeftRight className="w-3 h-3" />
        </button>

        {/* Split Ratio Indicator */}
        <div className="text-xs text-gray-500 px-2">
          {Math.round(layout.splitRatio * 100)}% / {Math.round((1 - layout.splitRatio) * 100)}%
        </div>
      </div>
    </div>
  );
}