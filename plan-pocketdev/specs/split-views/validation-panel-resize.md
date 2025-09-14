# Validation Panel Resize Feature

<!-- Document Metadata
Created: 2025-07-31
Modified: 2025-07-31
Status: ????
-->


## Overview
This document describes the implementation of the resizable validation/merge panel and its interaction with split view modes.

## Features Implemented

### 1. Resizable Horizontal Divider
- Drag handle between terminal and validation/merge panels
- Visual feedback during drag:
  - Handle changes color when hovering (gray → blue)
  - Handle becomes white when actively dragging
  - Percentage indicator shows current panel size
- Height constraints: 20% minimum, 80% maximum for each panel
- Smooth animations with 300ms transitions

### 2. Split View Constraints with Validation Mode
When the validation panel is active, split view modes have intelligent constraints based on available terminal height:

#### Viewport Requirements
- **Vertical Split**: 
  - Width: 1000px minimum
  - Height: No restriction (works with any terminal height)
- **Horizontal Split**: 
  - Height: 600px minimum terminal space
- **Quad View**: 
  - Width: 1400px minimum
  - Height: 600px minimum terminal space (same as horizontal)

#### Dynamic Behavior
- Uses `ResizeObserver` to monitor actual terminal container height
- Auto-downgrades from unavailable modes when space becomes insufficient
- Alt+D cycling skips modes that don't meet current constraints
- Ensures users can't get stuck in unusable split configurations

## Implementation Details

### State Management
- Resize state (`terminalHeight`, `isDraggingDivider`) managed in `TaskWorkspace`
- Props passed down to both `TerminalPanel` and `LensSlider` components
- Terminal height calculated as percentage, validation panel takes remainder

### Components Modified
1. **TaskWorkspace.tsx**
   - Added resize state management
   - Passes height to terminal panel style
   - Provides callbacks to LensSlider for resize events

2. **LensSlider.tsx**
   - Implements drag handle with mouse event handlers
   - Shows percentage indicator during drag
   - Accepts height props from parent

3. **TerminalPanel.tsx**
   - Uses `terminalContainerRef` to measure actual height
   - Updates split view constraints based on available space
   - ResizeObserver monitors container size changes

### CSS Classes
- Resize handle: `h-2 cursor-row-resize transition-all`
- Hover state: `hover:bg-blue-500`
- Active dragging: `bg-blue-500` with white grip indicator
- Uses Tailwind's `group` utility for coordinated hover states

## Testing Considerations
1. Test resize behavior at different viewport sizes
2. Verify constraints update correctly when dragging
3. Ensure split view modes auto-downgrade appropriately
4. Check that Alt+D skips unavailable modes
5. Validate minimum/maximum height constraints work correctly