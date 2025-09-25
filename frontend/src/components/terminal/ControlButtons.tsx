/**
 * ControlButtons - Terminal panel control buttons
 * 
 * Extracted from TerminalPanel to reduce complexity.
 * Provides UI controls for split view modes, refresh, fullscreen, etc.
 */

import { Eye, EyeOff, RefreshCw, ExternalLink, Monitor, Square, Columns, Rows, Grid2x2 } from 'lucide-react';
import type { SplitLayoutConfig } from '../../stores/splitViewStore';

interface ControlButtonsProps {
  // Layout state
  layout: SplitLayoutConfig;
  canShowVertical: boolean;
  canShowHorizontal: boolean;
  canShowQuad: boolean;
  
  // UI state
  isFullscreen: boolean;
  isResetting: boolean;
  validationMode: boolean;
  sessionStatuses: Map<string, 'connected' | 'disconnected' | 'error'>;
  
  // Task data
  taskProjectId?: string;
  taskId: string;
  
  // Callbacks
  onLayoutUpdate: (changes: Partial<SplitLayoutConfig>) => void;
  onLayoutSave: () => void;
  onToggleSidebar: () => void;
  onRefreshSession: () => void;
  onToggleValidation: () => void;
}

export function ControlButtons({
  layout,
  canShowVertical,
  canShowHorizontal,
  canShowQuad,
  isFullscreen,
  isResetting,
  validationMode,
  sessionStatuses,
  taskProjectId,
  taskId,
  onLayoutUpdate,
  onLayoutSave,
  onToggleSidebar,
  onRefreshSession,
  onToggleValidation
}: ControlButtonsProps) {
  
  const handleSplitViewToggle = () => {
    if (layout.mode === 'tab') {
      // Switch to vertical split if allowed, otherwise horizontal, otherwise stay in tab
      if (canShowVertical) {
        onLayoutUpdate({ mode: 'split', orientation: 'vertical' });
      } else if (canShowHorizontal) {
        onLayoutUpdate({ mode: 'split', orientation: 'horizontal' });
      }
      // If neither split view is possible, stay in tab mode
    } else if (layout.mode === 'split' && layout.orientation === 'vertical') {
      // Switch to horizontal split if allowed, otherwise quad if allowed, otherwise tab
      if (canShowHorizontal) {
        onLayoutUpdate({ orientation: 'horizontal' });
      } else if (canShowQuad) {
        onLayoutUpdate({ mode: 'split-4' });
      } else {
        onLayoutUpdate({ mode: 'tab' });
      }
    } else if (layout.mode === 'split' && layout.orientation === 'horizontal') {
      // Switch to quad view if allowed, otherwise back to tab
      if (canShowQuad) {
        onLayoutUpdate({ mode: 'split-4' });
      } else {
        onLayoutUpdate({ mode: 'tab' });
      }
    } else {
      // From quad view, always go back to tab mode
      onLayoutUpdate({ mode: 'tab' });
    }
    // Save layout after any changes
    onLayoutSave();
  };
  
  const getSplitViewTitle = () => {
    if (layout.mode === 'tab') {
      return (!canShowVertical && !canShowHorizontal) 
        ? 'Screen too small for split view' 
        : 'Enable split view (Alt+D)';
    }
    if (layout.mode === 'split' && layout.orientation === 'vertical') {
      return !canShowHorizontal 
        ? 'Switch to single tab view (Alt+D) - Screen too narrow for horizontal split' 
        : 'Switch to horizontal split (Alt+D)';
    }
    if (layout.mode === 'split' && layout.orientation === 'horizontal') {
      return !canShowQuad 
        ? 'Switch to single tab view (Alt+D) - Screen too small for quad view' 
        : 'Switch to quad view (Alt+D)';
    }
    if (layout.mode === 'split-4') {
      return 'Switch to single tab view (Alt+D)';
    }
    return 'Switch to single tab view (Alt+D)';
  };
  
  const getSplitViewIcon = () => {
    switch (layout.mode) {
      case 'tab':
        return <Square className="w-4 h-4" />;
      case 'split':
        return layout.orientation === 'vertical' 
          ? <Columns className="w-4 h-4" />  // Columns icon for vertical split (side by side)
          : <Rows className="w-4 h-4" />;     // Rows icon for horizontal split (top/bottom)
      case 'split-4':
        return <Grid2x2 className="w-4 h-4" />;  // Grid icon for quad view
      default:
        return <Square className="w-4 h-4" />;
    }
  };
  
  const hasDisconnectedSessions = Array.from(sessionStatuses.values()).some(
    s => s === 'disconnected' || s === 'error'
  );
  
  const handleOpenInNewWindow = () => {
    const url = `/terminal/${taskProjectId}/${taskId}`;
    const features = 'width=1400,height=800,menubar=no,toolbar=no,location=no,status=no';
    window.open(url, `terminal-${taskId}`, features);
  };
  
  return (
    <>
      {/* Split View Toggle */}
      <button 
        onClick={handleSplitViewToggle}
        className={`p-1 transition-colors ${
          layout.mode !== 'tab' 
            ? 'text-blue-400 hover:text-blue-300' 
            : 'text-gray-400 hover:text-gray-200'
        }`}
        title={getSplitViewTitle()}
      >
        {getSplitViewIcon()}
      </button>
      
      {/* Fullscreen Toggle */}
      <button 
        onClick={onToggleSidebar}
        className="text-gray-400 hover:text-gray-200 p-1"
        title={isFullscreen ? "Exit fullscreen (Alt+F)" : "Enter fullscreen (Alt+F)"}
      >
        {isFullscreen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
      
      {/* Refresh Button */}
      <button 
        onClick={(e) => {
          // In split view mode, let the SplitViewContainer handle it
          if (layout.mode === 'split' || layout.mode === 'split-4') {
            // Just mark the button with data-action, the event will bubble up
            return;
          }
          // In tab mode, handle it here
          onRefreshSession();
        }}
        data-action="refresh"
        className={`p-1 transition-colors ${
          isResetting 
            ? 'text-blue-400 animate-spin' 
            : hasDisconnectedSessions
            ? 'text-orange-400 hover:text-orange-300'
            : 'text-gray-400 hover:text-gray-200'
        }`}
        disabled={isResetting}
        title={hasDisconnectedSessions 
          ? "Reconnect and restore terminal session (Ctrl+Shift+R)" 
          : "Refresh terminal - sync state, reload buffer, restore cursor (Ctrl+Shift+R)"}
      >
        <RefreshCw className="w-4 h-4" />
      </button>
      
      {/* Open in New Window */}
      <button 
        onClick={handleOpenInNewWindow}
        className="text-gray-400 hover:text-gray-200 p-1"
        title="Open in new window"
      >
        <ExternalLink className="w-4 h-4" />
      </button>
      
      {/* Validation Mode Toggle */}
      <button 
        onClick={onToggleValidation}
        className={`p-1 transition-colors ${
          validationMode ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        <Monitor className="w-4 h-4" />
      </button>
    </>
  );
}