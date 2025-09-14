/**
 * Split View Feature Module
 * 
 * Complete implementation of terminal split view functionality.
 * Consolidates logic from:
 * - SplitViewContainer (468 lines)
 * - SplitViewControls (273 lines)
 * - useLayoutConstraints (127 lines)
 * 
 * Following AI-assisted architecture principles:
 * "One concept, one file, complete implementation"
 * This allows AI to understand the entire split view feature by reading one file.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSplitViewStore, useSplitLayout, saveLayout } from '../stores/splitViewStore';
import { useTerminalStore } from '../stores/terminal/terminalStore.deep';
import type { TerminalSession } from '../types/task';
import type { SplitLayoutConfig } from '../stores/splitViewStore';
import type { DirectTerminalHandle } from '../components/terminal/DirectTerminal';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface SplitViewConfig {
  taskId: string;
  projectId?: string;
  worktreePath?: string;
  isVisible: boolean;
  terminals: TerminalSession[];
  activeTabId: string;
  terminalRefs?: React.MutableRefObject<Map<string, DirectTerminalHandle>>;
  containerRef?: React.RefObject<HTMLDivElement>;
  onSessionStatus?: (dbSessionId: string, status: 'connected' | 'disconnected' | 'error') => void;
  onTerminalReorder?: (reorderedTerminals: TerminalSession[]) => void;
  onTerminalSelect?: (dbSessionId: string) => void;
}

export interface LayoutConstraints {
  canShowQuad: boolean;
  canShowHorizontal: boolean;
  canShowVertical: boolean;
}

export interface SplitViewFeature {
  // Layout state
  layout: SplitLayoutConfig;
  constraints: LayoutConstraints;
  
  // Resize state
  isResizing: boolean;
  resizeHandleProps: ResizeHandleProps;
  
  // Terminal assignment
  primaryTerminal: TerminalSession | undefined;
  secondaryTerminal: TerminalSession | undefined;
  tertiaryTerminal: TerminalSession | undefined;
  quaternaryTerminal: TerminalSession | undefined;
  
  // Dropdown state for terminal selection
  dropdowns: {
    primary: DropdownState;
    secondary: DropdownState;
    tertiary: DropdownState;
    quaternary: DropdownState;
  };
  
  // Layout operations
  setLayoutMode: (mode: 'tab' | 'split' | 'split-4') => void;
  setOrientation: (orientation: 'horizontal' | 'vertical') => void;
  cycleLayout: () => void;
  swapTerminals: () => void;
  
  // Terminal operations
  reorderTerminals: (fromIndex: number, toIndex: number) => void;
  selectTerminal: (position: 'primary' | 'secondary' | 'tertiary' | 'quaternary', terminalId: string) => void;
  
  // Mobile detection
  isMobile: boolean;
}

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  style: React.CSSProperties;
  className: string;
}

interface DropdownState {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  availableTerminals: TerminalSession[];
  selectedTerminal: TerminalSession | undefined;
  onSelect: (terminalId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const LAYOUT_THRESHOLDS = {
  minHeightForHorizontalSplits: 600,
  minWidthForVertical: 1000,
  minWidthForQuad: 1400,
  headerHeight: 200, // Approximate header + tabs height
  minSplitRatio: 0.2,
  maxSplitRatio: 0.8,
  mobileBreakpoint: 768
} as const;

// ============================================================================
// Main Feature Hook
// ============================================================================

export function useSplitView(config: SplitViewConfig): SplitViewFeature {
  const {
    taskId,
    terminals,
    containerRef,
    onTerminalReorder,
    onTerminalSelect
  } = config;
  
  // Store hooks
  const layout = useSplitLayout();
  const { setSplitRatio, setResizing, updateLayout } = useSplitViewStore();
  const terminalStore = useTerminalStore();
  
  // Local state
  const [isDragging, setIsDragging] = useState(false);
  const [constraints, setConstraints] = useState<LayoutConstraints>({
    canShowQuad: false,
    canShowHorizontal: false,
    canShowVertical: false
  });
  const [isMobile, setIsMobile] = useState(false);
  
  // Dropdown states
  const [showPrimaryDropdown, setShowPrimaryDropdown] = useState(false);
  const [showSecondaryDropdown, setShowSecondaryDropdown] = useState(false);
  const [showTertiaryDropdown, setShowTertiaryDropdown] = useState(false);
  const [showQuaternaryDropdown, setShowQuaternaryDropdown] = useState(false);
  
  // Refs for resize handling
  const rafRef = useRef<number | null>(null);
  
  // ============================================================================
  // Terminal Assignment (Order-based)
  // ============================================================================
  
  const primaryTerminal = terminals[0];
  const secondaryTerminal = terminals[1];
  const tertiaryTerminal = terminals[2];
  const quaternaryTerminal = terminals[3];
  
  // ============================================================================
  // Layout Constraints Calculation
  // ============================================================================
  
  const calculateConstraints = useCallback((): LayoutConstraints => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Calculate effective terminal height
    const effectiveHeight = height - LAYOUT_THRESHOLDS.headerHeight;
    const containerHeight = containerRef?.current?.offsetHeight || effectiveHeight;
    
    return {
      canShowQuad: width >= LAYOUT_THRESHOLDS.minWidthForQuad && 
                   containerHeight >= LAYOUT_THRESHOLDS.minHeightForHorizontalSplits,
      canShowHorizontal: containerHeight >= LAYOUT_THRESHOLDS.minHeightForHorizontalSplits,
      canShowVertical: width >= LAYOUT_THRESHOLDS.minWidthForVertical
    };
  }, [containerRef]);
  
  // Auto-downgrade layout if viewport becomes too small
  const checkAndDowngrade = useCallback(() => {
    const newConstraints = calculateConstraints();
    
    // If in quad view but screen too small, downgrade
    if (layout.mode === 'split-4' && !newConstraints.canShowQuad) {
      if (newConstraints.canShowHorizontal) {
        updateLayout({ mode: 'split', orientation: 'horizontal' });
      } else if (newConstraints.canShowVertical) {
        updateLayout({ mode: 'split', orientation: 'vertical' });
      } else {
        updateLayout({ mode: 'tab' });
      }
    }
    // If in horizontal split but screen too short
    else if (layout.mode === 'split' && layout.orientation === 'horizontal' && !newConstraints.canShowHorizontal) {
      if (newConstraints.canShowVertical) {
        updateLayout({ orientation: 'vertical' });
      } else {
        updateLayout({ mode: 'tab' });
      }
    }
    // If in vertical split but screen too narrow
    else if (layout.mode === 'split' && layout.orientation === 'vertical' && !newConstraints.canShowVertical) {
      if (newConstraints.canShowHorizontal) {
        updateLayout({ orientation: 'horizontal' });
      } else {
        updateLayout({ mode: 'tab' });
      }
    }
  }, [layout.mode, layout.orientation, calculateConstraints, updateLayout]);
  
  // ============================================================================
  // Resize Handler
  // ============================================================================
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setResizing(true);
    
    const container = containerRef?.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging && e.buttons !== 1) return;
      
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      
      rafRef.current = requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect();
        const isHorizontal = layout.orientation === 'horizontal';
        
        let ratio: number;
        if (isHorizontal) {
          ratio = (e.clientY - rect.top) / rect.height;
        } else {
          ratio = (e.clientX - rect.left) / rect.width;
        }
        
        ratio = Math.max(LAYOUT_THRESHOLDS.minSplitRatio, Math.min(LAYOUT_THRESHOLDS.maxSplitRatio, ratio));
        setSplitRatio(ratio);
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
  }, [isDragging, layout.orientation, setSplitRatio, setResizing, containerRef]);
  
  // ============================================================================
  // Terminal Reordering
  // ============================================================================
  
  const reorderTerminals = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    
    const newOrder = [...terminals];
    const [removed] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, removed);
    
    // Update terminal order in store
    newOrder.forEach((terminal, index) => {
      terminalStore.updateTerminal(taskId, terminal.dbSessionId, {
        type: 'reorder',
        order: index
      });
    });
    
    // Notify parent component
    onTerminalReorder?.(newOrder);
  }, [terminals, taskId, terminalStore, onTerminalReorder]);
  
  // Swap primary and secondary terminals
  const swapTerminals = useCallback(() => {
    if (!primaryTerminal || !secondaryTerminal) return;
    reorderTerminals(0, 1);
  }, [primaryTerminal, secondaryTerminal, reorderTerminals]);
  
  // ============================================================================
  // Terminal Selection (via dropdowns)
  // ============================================================================
  
  const selectTerminal = useCallback((position: 'primary' | 'secondary' | 'tertiary' | 'quaternary', terminalId: string) => {
    const targetTerminal = terminals.find(t => t.dbSessionId === terminalId);
    if (!targetTerminal) return;
    
    const positionIndex = {
      primary: 0,
      secondary: 1,
      tertiary: 2,
      quaternary: 3
    }[position];
    
    const currentIndex = terminals.findIndex(t => t.dbSessionId === terminalId);
    if (currentIndex !== positionIndex) {
      reorderTerminals(currentIndex, positionIndex);
    }
    
    // Close dropdown and notify parent
    switch (position) {
      case 'primary':
        setShowPrimaryDropdown(false);
        break;
      case 'secondary':
        setShowSecondaryDropdown(false);
        break;
      case 'tertiary':
        setShowTertiaryDropdown(false);
        break;
      case 'quaternary':
        setShowQuaternaryDropdown(false);
        break;
    }
    
    onTerminalSelect?.(terminalId);
  }, [terminals, reorderTerminals, onTerminalSelect]);
  
  // ============================================================================
  // Layout Mode Changes
  // ============================================================================
  
  const setLayoutMode = useCallback((mode: 'tab' | 'split' | 'split-4') => {
    updateLayout({ mode });
    saveLayout();
  }, [updateLayout]);
  
  const setOrientation = useCallback((orientation: 'horizontal' | 'vertical') => {
    updateLayout({ orientation });
    saveLayout();
  }, [updateLayout]);
  
  const cycleLayout = useCallback(() => {
    // Cycle through: tab -> split -> split-4 -> tab
    let nextMode: 'tab' | 'split' | 'split-4';
    switch (layout.mode) {
      case 'tab':
        nextMode = 'split';
        break;
      case 'split':
        nextMode = 'split-4';
        break;
      case 'split-4':
        nextMode = 'tab';
        break;
    }
    
    // Check constraints before switching
    if (nextMode === 'split-4' && !constraints.canShowQuad) {
      nextMode = 'split';
    }
    if (nextMode === 'split' && !constraints.canShowHorizontal && !constraints.canShowVertical) {
      nextMode = 'tab';
    }
    
    setLayoutMode(nextMode);
  }, [layout.mode, constraints, setLayoutMode]);
  
  // ============================================================================
  // Effects
  // ============================================================================
  
  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < LAYOUT_THRESHOLDS.mobileBreakpoint);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Monitor viewport changes and update constraints
  useEffect(() => {
    const handleResize = () => {
      const newConstraints = calculateConstraints();
      setConstraints(newConstraints);
      checkAndDowngrade();
    };
    
    // Initial calculation
    handleResize();
    
    // Listen for window resize
    window.addEventListener('resize', handleResize);
    
    // Also observe container size changes
    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef?.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [calculateConstraints, checkAndDowngrade, containerRef]);
  
  // Close dropdowns on outside click
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
  
  // ============================================================================
  // Build Dropdown States
  // ============================================================================
  
  const getAvailableTerminals = useCallback((excludeIds: string[], currentTerminal?: TerminalSession) => {
    return terminals.filter(t => 
      t.dbSessionId === currentTerminal?.dbSessionId || !excludeIds.includes(t.dbSessionId)
    );
  }, [terminals]);
  
  const dropdowns: SplitViewFeature['dropdowns'] = useMemo(() => ({
    primary: {
      isOpen: showPrimaryDropdown,
      toggle: () => setShowPrimaryDropdown(prev => !prev),
      close: () => setShowPrimaryDropdown(false),
      availableTerminals: getAvailableTerminals([secondaryTerminal?.dbSessionId, tertiaryTerminal?.dbSessionId, quaternaryTerminal?.dbSessionId].filter(Boolean) as string[], primaryTerminal),
      selectedTerminal: primaryTerminal,
      onSelect: (id: string) => selectTerminal('primary', id)
    },
    secondary: {
      isOpen: showSecondaryDropdown,
      toggle: () => setShowSecondaryDropdown(prev => !prev),
      close: () => setShowSecondaryDropdown(false),
      availableTerminals: getAvailableTerminals([primaryTerminal?.dbSessionId, tertiaryTerminal?.dbSessionId, quaternaryTerminal?.dbSessionId].filter(Boolean) as string[], secondaryTerminal),
      selectedTerminal: secondaryTerminal,
      onSelect: (id: string) => selectTerminal('secondary', id)
    },
    tertiary: {
      isOpen: showTertiaryDropdown,
      toggle: () => setShowTertiaryDropdown(prev => !prev),
      close: () => setShowTertiaryDropdown(false),
      availableTerminals: getAvailableTerminals([primaryTerminal?.dbSessionId, secondaryTerminal?.dbSessionId, quaternaryTerminal?.dbSessionId].filter(Boolean) as string[], tertiaryTerminal),
      selectedTerminal: tertiaryTerminal,
      onSelect: (id: string) => selectTerminal('tertiary', id)
    },
    quaternary: {
      isOpen: showQuaternaryDropdown,
      toggle: () => setShowQuaternaryDropdown(prev => !prev),
      close: () => setShowQuaternaryDropdown(false),
      availableTerminals: getAvailableTerminals([primaryTerminal?.dbSessionId, secondaryTerminal?.dbSessionId, tertiaryTerminal?.dbSessionId].filter(Boolean) as string[], quaternaryTerminal),
      selectedTerminal: quaternaryTerminal,
      onSelect: (id: string) => selectTerminal('quaternary', id)
    }
  }), [
    showPrimaryDropdown, showSecondaryDropdown, showTertiaryDropdown, showQuaternaryDropdown,
    primaryTerminal, secondaryTerminal, tertiaryTerminal, quaternaryTerminal,
    getAvailableTerminals, selectTerminal
  ]);
  
  // ============================================================================
  // Build Resize Handle Props
  // ============================================================================
  
  const resizeHandleProps: ResizeHandleProps = useMemo(() => ({
    onMouseDown: handleMouseDown,
    style: layout.orientation === 'horizontal' ? {
      top: `${layout.splitRatio * 100}%`,
      cursor: 'ns-resize'
    } : {
      left: `${layout.splitRatio * 100}%`,
      cursor: 'ew-resize'
    },
    className: `absolute ${layout.orientation === 'horizontal' ? 'w-full h-1' : 'h-full w-1'} bg-gray-700 hover:bg-blue-500 transition-colors z-40`
  }), [handleMouseDown, layout.orientation, layout.splitRatio]);
  
  // ============================================================================
  // Return Complete Feature Interface
  // ============================================================================
  
  return {
    // Layout state
    layout,
    constraints,
    
    // Resize state
    isResizing: isDragging,
    resizeHandleProps,
    
    // Terminal assignment
    primaryTerminal,
    secondaryTerminal,
    tertiaryTerminal,
    quaternaryTerminal,
    
    // Dropdown state
    dropdowns,
    
    // Layout operations
    setLayoutMode,
    setOrientation,
    cycleLayout,
    swapTerminals,
    
    // Terminal operations
    reorderTerminals,
    selectTerminal,
    
    // Mobile detection
    isMobile
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get AI state color for terminal status indicators
 */
export function getTerminalStateColor(state?: string): string {
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
}

/**
 * Get layout icon based on mode and orientation
 */
export function getLayoutIcon(mode: string, orientation?: string): 'tab' | 'split-h' | 'split-v' | 'quad' {
  if (mode === 'tab') return 'tab';
  if (mode === 'split-4') return 'quad';
  if (mode === 'split') {
    return orientation === 'horizontal' ? 'split-h' : 'split-v';
  }
  return 'tab';
}