# Split View Phase 2 Update

<!-- Document Metadata
Created: 2025-07-29
Modified: 2025-07-29
Status: ????
-->


## Overview
Phase 2 improvements to the split view feature focus on UI/UX enhancements, making the split view mode more intuitive and visually consistent with the rest of the application.

## Key Improvements

### 1. Unified Tab/Split Interface
- **Problem**: Having both tabs and split controls visible was confusing
- **Solution**: When in split mode, tab bar is replaced with split view controls
- **Result**: Cleaner UI with clear modal distinction between tab and split modes

### 2. Tab-Style Terminal Selectors
- Terminal selectors now styled like tabs for visual consistency
- Active terminal highlighted with same styling as active tabs
- Color coding: Blue dot for primary, green dot for secondary terminal
- Maintains familiar tab metaphor while in split mode

### 3. Improved Control Placement
- Split view toggle moved to terminal header with other view controls
- Always accessible regardless of current mode
- Icons change based on state:
  - Maximize icon when in tab mode (to enable split)
  - Columns icon when in split mode (to return to tabs)

### 4. Streamlined Controls
- Orientation toggle, swap button, and ratio indicator inline with terminal "tabs"
- Smaller, more compact controls that don't dominate the interface
- Split ratio shown as subtle text (e.g., "60% / 40%")

## Technical Implementation

### Component Changes
1. **TerminalPanel**: Now conditionally renders either TerminalTabs or SplitViewControls
2. **SplitViewControls**: Redesigned with tab-like styling and compact layout
3. **State Management**: Uses existing split view store with no changes needed

### User Experience Flow
1. User clicks split view toggle in header
2. Tab bar transforms into split view controls
3. User selects terminals via dropdown "tabs"
4. Can switch orientation, swap, or adjust ratio
5. Click toggle again to return to tab mode

## Benefits
- **Clarity**: Clear distinction between tab and split modes
- **Consistency**: Uses familiar tab styling paradigm
- **Accessibility**: Controls always visible in header
- **Efficiency**: Less visual clutter, more terminal space