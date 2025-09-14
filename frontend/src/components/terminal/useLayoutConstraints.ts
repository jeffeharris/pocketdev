/**
 * useLayoutConstraints Hook
 * 
 * Manages viewport-based layout constraints for terminal split views.
 * Extracts ~80 lines of layout calculation and auto-downgrade logic.
 * 
 * Responsibilities:
 * - Monitoring viewport dimensions
 * - Calculating which layouts are possible
 * - Auto-downgrading layouts when viewport becomes too small
 * - Managing terminal header height calculations
 */

import { useEffect, useMemo, useCallback } from 'react';
import type { SplitLayoutConfig } from '../../stores/splitViewStore';

interface LayoutConstraints {
  canShowQuad: boolean;
  canShowHorizontal: boolean;
  canShowVertical: boolean;
}

interface UseLayoutConstraintsProps {
  // Current layout configuration
  layout: SplitLayoutConfig;
  
  // Terminal container ref for height measurements
  terminalContainerRef: React.RefObject<HTMLDivElement>;
  
  // Callbacks
  updateLayout: (updates: Partial<SplitLayoutConfig>) => void;
  onConstraintsChange: (constraints: LayoutConstraints) => void;
}

// Layout thresholds - single source of truth
const LAYOUT_THRESHOLDS = {
  minHeightForHorizontalSplits: 600,
  minWidthForVertical: 1000,
  minWidthForQuad: 1400,
  headerHeight: 200 // Approximate header + tabs height
} as const;

export function useLayoutConstraints({
  layout,
  terminalContainerRef,
  updateLayout,
  onConstraintsChange
}: UseLayoutConstraintsProps): LayoutConstraints {
  
  // Single function to calculate constraints - eliminates duplication
  const calculateConstraints = useCallback((): LayoutConstraints => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Calculate effective terminal height
    const effectiveHeight = height - LAYOUT_THRESHOLDS.headerHeight;
    const containerHeight = terminalContainerRef.current?.offsetHeight || effectiveHeight;
    
    return {
      canShowQuad: width >= LAYOUT_THRESHOLDS.minWidthForQuad && 
                   containerHeight >= LAYOUT_THRESHOLDS.minHeightForHorizontalSplits,
      canShowHorizontal: containerHeight >= LAYOUT_THRESHOLDS.minHeightForHorizontalSplits,
      canShowVertical: width >= LAYOUT_THRESHOLDS.minWidthForVertical
    };
  }, [terminalContainerRef]);
  
  // Auto-downgrade layout if viewport becomes too small
  const checkAndDowngrade = useCallback(() => {
    const constraints = calculateConstraints();
    
    // If in quad view but screen too small, downgrade
    if (layout.mode === 'split-4' && !constraints.canShowQuad) {
      // Try horizontal split first, then vertical, then tab
      if (constraints.canShowHorizontal) {
        updateLayout({ mode: 'split', orientation: 'horizontal' });
      } else if (constraints.canShowVertical) {
        updateLayout({ mode: 'split', orientation: 'vertical' });
      } else {
        updateLayout({ mode: 'tab' });
      }
    }
    // If in horizontal split but screen too short, switch to vertical or tab
    else if (layout.mode === 'split' && layout.orientation === 'horizontal' && !constraints.canShowHorizontal) {
      if (constraints.canShowVertical) {
        updateLayout({ orientation: 'vertical' });
      } else {
        updateLayout({ mode: 'tab' });
      }
    }
    // If in vertical split but screen too narrow, switch to horizontal or tab
    else if (layout.mode === 'split' && layout.orientation === 'vertical' && !constraints.canShowVertical) {
      if (constraints.canShowHorizontal) {
        updateLayout({ orientation: 'horizontal' });
      } else {
        updateLayout({ mode: 'tab' });
      }
    }
  }, [layout.mode, layout.orientation, calculateConstraints, updateLayout]);
  
  // Monitor viewport changes and update constraints
  useEffect(() => {
    const handleResize = () => {
      const constraints = calculateConstraints();
      onConstraintsChange(constraints);
      checkAndDowngrade();
    };
    
    // Initial calculation
    handleResize();
    
    // Listen for window resize
    window.addEventListener('resize', handleResize);
    
    // Also observe container size changes
    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalContainerRef.current) {
      resizeObserver.observe(terminalContainerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [calculateConstraints, onConstraintsChange, checkAndDowngrade, terminalContainerRef]);
  
  // Memoize current constraints for return value
  return useMemo(() => calculateConstraints(), [calculateConstraints]);
}