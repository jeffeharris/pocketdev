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

import { useEffect } from 'react';
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

export function useLayoutConstraints({
  layout,
  terminalContainerRef,
  updateLayout,
  onConstraintsChange
}: UseLayoutConstraintsProps): LayoutConstraints {
  // Calculate viewport constraints on mount and resize
  useEffect(() => {
    const checkViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Calculate effective terminal height by subtracting header/tabs
      const headerHeight = 200; // Approximate header + tabs height
      const effectiveHeight = height - headerHeight;
      
      // Use actual container height if available for more accurate calculation
      const containerHeight = terminalContainerRef.current?.offsetHeight || effectiveHeight;
      
      // Define thresholds for different layouts
      const minHeightForHorizontalSplits = 600;
      const minWidthForVertical = 1000;
      const minWidthForQuad = 1400;
      
      const constraints: LayoutConstraints = {
        quad: width >= minWidthForQuad && containerHeight >= minHeightForHorizontalSplits,
        horizontal: containerHeight >= minHeightForHorizontalSplits,
        vertical: width >= minWidthForVertical
      };
      
      onConstraintsChange(constraints);
      
      // Return constraints for immediate use
      return constraints;
    };
    
    // Initial check
    const initialConstraints = checkViewport();
    
    // Set up resize listener
    const handleResize = () => {
      checkViewport();
    };
    
    window.addEventListener('resize', handleResize);
    
    // Also observe container size changes
    const resizeObserver = new ResizeObserver(() => {
      checkViewport();
    });
    
    if (terminalContainerRef.current) {
      resizeObserver.observe(terminalContainerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [terminalContainerRef, onConstraintsChange]);
  
  // Auto-downgrade layout if viewport becomes too small
  useEffect(() => {
    const checkAndDowngrade = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const headerHeight = 200;
      const effectiveHeight = height - headerHeight;
      const containerHeight = terminalContainerRef.current?.offsetHeight || effectiveHeight;
      
      const minHeightForHorizontalSplits = 600;
      const minWidthForVertical = 1000;
      const minWidthForQuad = 1400;
      
      const canShowQuad = width >= minWidthForQuad && containerHeight >= minHeightForHorizontalSplits;
      const canShowHorizontal = containerHeight >= minHeightForHorizontalSplits;
      const canShowVertical = width >= minWidthForVertical;
      
      // If in quad view but screen too small, downgrade
      if (layout.mode === 'split-4' && !canShowQuad) {
        // Try horizontal split first, then vertical, then tab
        if (canShowHorizontal) {
          updateLayout({ mode: 'split', orientation: 'horizontal' });
        } else if (canShowVertical) {
          updateLayout({ mode: 'split', orientation: 'vertical' });
        } else {
          updateLayout({ mode: 'tab' });
        }
      }
      // If in horizontal split but screen too short, switch to vertical or tab
      else if (layout.mode === 'split' && layout.orientation === 'horizontal' && !canShowHorizontal) {
        if (canShowVertical) {
          updateLayout({ orientation: 'vertical' });
        } else {
          updateLayout({ mode: 'tab' });
        }
      }
      // If in vertical split but screen too narrow, switch to horizontal or tab
      else if (layout.mode === 'split' && layout.orientation === 'vertical' && !canShowVertical) {
        if (canShowHorizontal) {
          updateLayout({ orientation: 'horizontal' });
        } else {
          updateLayout({ mode: 'tab' });
        }
      }
    };
    
    checkAndDowngrade();
    
    const handleResize = () => {
      checkAndDowngrade();
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [layout.mode, layout.orientation, terminalContainerRef, updateLayout]);
  
  // Calculate current constraints for return value
  const width = window.innerWidth;
  const height = window.innerHeight;
  const headerHeight = 200;
  const effectiveHeight = height - headerHeight;
  const containerHeight = terminalContainerRef.current?.offsetHeight || effectiveHeight;
  
  const minHeightForHorizontalSplits = 600;
  const minWidthForVertical = 1000;
  const minWidthForQuad = 1400;
  
  return {
    canShowQuad: width >= minWidthForQuad && containerHeight >= minHeightForHorizontalSplits,
    canShowHorizontal: containerHeight >= minHeightForHorizontalSplits,
    canShowVertical: width >= minWidthForVertical
  };
}