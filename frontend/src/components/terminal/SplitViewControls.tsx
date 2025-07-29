import { useState, useRef, useEffect } from 'react';
import { 
  Columns, 
  Rows, 
  Maximize2, 
  ArrowLeftRight,
  ChevronDown,
  Monitor
} from 'lucide-react';
import { useSplitViewStore, useSplitLayout } from '../../stores/splitViewStore';
import { useTaskTerminals } from '../../stores/terminalStore';
import type { TerminalSession } from '../../types/task';

interface SplitViewControlsProps {
  taskId: string;
  activeTabId: string;
  onTerminalSelect?: (dbSessionId: string) => void;
}

export function SplitViewControls({
  taskId,
  activeTabId,
  onTerminalSelect
}: SplitViewControlsProps) {
  const layout = useSplitLayout(taskId);
  const terminals = useTaskTerminals(taskId);
  const { toggleSplitMode, updateLayout, swapPanes, setPrimaryTerminal, setSecondaryTerminal } = useSplitViewStore();
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

  // Get terminal names
  const primaryTerminal = terminals.find(t => t.dbSessionId === layout.primaryTerminalId);
  const secondaryTerminal = terminals.find(t => t.dbSessionId === layout.secondaryTerminalId);

  // Only show controls if we have 2+ terminals and not on mobile
  if (terminals.length < 2 || isMobile) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2 px-2 py-1 bg-gray-800 border-b border-gray-700">
      {/* Mode Toggle */}
      <button
        onClick={() => toggleSplitMode(taskId)}
        className={`p-1.5 rounded transition-colors ${
          layout.mode === 'split' 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-700 text-gray-400 hover:text-gray-200'
        }`}
        title={layout.mode === 'split' ? 'Switch to tab view' : 'Enable split view'}
      >
        {layout.mode === 'split' ? <Columns className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>

      {/* Split View Controls - Only show when in split mode */}
      {layout.mode === 'split' && (
        <>
          {/* Orientation Toggle */}
          <div className="flex items-center bg-gray-700 rounded">
            <button
              onClick={() => updateLayout(taskId, { orientation: 'horizontal' })}
              className={`p-1.5 rounded-l transition-colors ${
                layout.orientation === 'horizontal'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Horizontal split"
            >
              <Columns className="w-4 h-4" />
            </button>
            <button
              onClick={() => updateLayout(taskId, { orientation: 'vertical' })}
              className={`p-1.5 rounded-r transition-colors ${
                layout.orientation === 'vertical'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Vertical split"
            >
              <Rows className="w-4 h-4" />
            </button>
          </div>

          {/* Terminal Selectors */}
          <div className="flex items-center space-x-2 text-sm">
            {/* Primary Terminal Selector */}
            <div className="relative" ref={primaryDropdownRef}>
              <button
                onClick={() => setShowPrimaryDropdown(!showPrimaryDropdown)}
                className="flex items-center space-x-1 px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
              >
                <Monitor className="w-3 h-3" />
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
                        setPrimaryTerminal(taskId, terminal.dbSessionId);
                        setShowPrimaryDropdown(false);
                        if (onTerminalSelect) {
                          onTerminalSelect(terminal.dbSessionId);
                        }
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${
                        terminal.dbSessionId === layout.primaryTerminalId ? 'bg-gray-700' : ''
                      }`}
                      disabled={terminal.dbSessionId === layout.secondaryTerminalId}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{terminal.tabName}</span>
                        {terminal.dbSessionId === layout.secondaryTerminalId && (
                          <span className="text-xs text-gray-500">(in use)</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Swap Button */}
            <button
              onClick={() => swapPanes(taskId)}
              className="p-1.5 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
              title="Swap terminals"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>

            {/* Secondary Terminal Selector */}
            <div className="relative" ref={secondaryDropdownRef}>
              <button
                onClick={() => setShowSecondaryDropdown(!showSecondaryDropdown)}
                className="flex items-center space-x-1 px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
              >
                <Monitor className="w-3 h-3" />
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
                        setSecondaryTerminal(taskId, terminal.dbSessionId);
                        setShowSecondaryDropdown(false);
                        if (onTerminalSelect) {
                          onTerminalSelect(terminal.dbSessionId);
                        }
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${
                        terminal.dbSessionId === layout.secondaryTerminalId ? 'bg-gray-700' : ''
                      }`}
                      disabled={terminal.dbSessionId === layout.primaryTerminalId}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{terminal.tabName}</span>
                        {terminal.dbSessionId === layout.primaryTerminalId && (
                          <span className="text-xs text-gray-500">(in use)</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Split Ratio Indicator */}
          <div className="text-xs text-gray-500">
            {Math.round(layout.splitRatio * 100)}% / {Math.round((1 - layout.splitRatio) * 100)}%
          </div>
        </>
      )}
    </div>
  );
}