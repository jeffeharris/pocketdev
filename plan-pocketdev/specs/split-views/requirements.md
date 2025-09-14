# Split Views Feature Requirements

<!-- Document Metadata
Created: 2025-07-29
Modified: 2025-07-31
Status: ????
-->


## Overview

This document defines requirements for enabling split view functionality in PocketDev, allowing developers to view multiple terminal sessions simultaneously within a single task.

## Requirements in EARS Format

### Core Split View Requirements

**REQ-SV-001**: **WHERE** the user is viewing a task with multiple terminal sessions, **the system SHALL** provide split view controls in the terminal interface.

**REQ-SV-002**: **WHERE** the user activates split view mode, **the system SHALL** display a maximum of 4 terminal sessions simultaneously.

**REQ-SV-003**: **WHERE** split view is active, **the system SHALL** support horizontal (top/bottom) and vertical (left/right) split layouts.

**REQ-SV-004**: **WHERE** multiple terminals are displayed in split view, **the system SHALL** maintain independent scrollback buffers for each terminal.

**REQ-SV-005**: **WHERE** the user clicks on a terminal in split view, **the system SHALL** set that terminal as the active focus for keyboard input.

### Layout Management

**REQ-SV-006**: **WHERE** the user has activated split view, **the system SHALL** provide draggable dividers between terminals for resizing.

**REQ-SV-007**: **WHERE** the viewport width is less than 768px, **the system SHALL** automatically disable split view and revert to tab-based navigation.

**REQ-SV-008**: **WHERE** split view is active AND the user resizes the browser window below 768px, **the system SHALL** preserve the split configuration and restore it when the window is resized above 768px.

**REQ-SV-009**: **WHERE** the user double-clicks a divider between terminals, **the system SHALL** equalize the space between the affected terminals.

### Performance Requirements

**REQ-SV-010**: **[Priority: Low]** **WHERE** multiple terminals are rendered in split view AND terminal output rate is below 1000 lines/second per terminal, **the system SHALL** maintain a frame rate of at least 30fps.

**REQ-SV-011**: **WHERE** a terminal is not in focus in split view, **the system SHALL** throttle its render updates to reduce CPU usage.

**REQ-SV-012**: **WHERE** more than 2 terminals are active in split view, **the system SHALL** use lazy rendering for terminals outside the viewport.

### User Interface Requirements

**REQ-SV-013**: **WHERE** split view is available, **the system SHALL** display split control buttons adjacent to the tab controls.

**REQ-SV-014**: **WHERE** a terminal has focus in split view, **the system SHALL** highlight its border with the primary theme color.

**REQ-SV-015**: **WHERE** the user hovers over a non-focused terminal in split view, **the system SHALL** display a subtle highlight to indicate it can be selected.

**REQ-SV-016**: **WHERE** split view is active, **the system SHALL** display the terminal session name or ID in each split panel header.

### Session Management

**REQ-SV-017**: **WHERE** a terminal session is closed while in split view, **the system SHALL** automatically adjust the layout to use the available space.

**REQ-SV-017a**: **WHERE** the user first activates split view with multiple terminals available, **the system SHALL** automatically display the two most recently accessed terminal sessions in a horizontal split layout.

**REQ-SV-018**: **WHERE** only one terminal session remains active, **the system SHALL** automatically exit split view mode.

**REQ-SV-019**: **WHERE** the user switches between tasks, **the system SHALL** preserve the split view configuration for each task independently.

**REQ-SV-019a**: **[Priority: Low] [Status: COMPLETE ✅]** **WHERE** the user has configured a split view layout, **the system SHALL** persist the layout configuration to the database, allowing restoration across browser sessions.

### Keyboard Navigation

**REQ-SV-020**: **WHERE** split view is active, **the system SHALL** support Ctrl+Shift+Arrow keys to move focus between terminals.

**REQ-SV-021**: **WHERE** the user presses Ctrl+Shift+D in split view, **the system SHALL** toggle between horizontal and vertical split orientation.

**REQ-SV-022**: **WHERE** the user presses Escape while in split view, **the system SHALL** exit split view and return to the previously active tab.

### Future Enhancement Preparation

**REQ-SV-023**: **WHERE** the split view architecture is implemented, **the system SHALL** design the data model to support a future "cross-project view" mode that displays a list of tasks from all projects, allowing users to arrange terminals from different projects in custom layouts.

**REQ-SV-024**: **WHERE** split layouts are saved, **the system SHALL** use a flexible configuration format that can accommodate custom layouts beyond 2x2 grids.

## Non-Functional Requirements

**REQ-SV-025**: **WHERE** split view is implemented, **the system SHALL** ensure WebSocket connections for all visible terminals remain stable and synchronized.

**REQ-SV-026**: **WHERE** multiple xterm.js instances are rendered, **the system SHALL** properly dispose of terminal instances when switching views to prevent memory leaks.

**REQ-SV-027**: **WHERE** split view is active on mobile devices (if enabled via settings), **the system SHALL** provide touch-friendly resize handles of at least 20px width.

## Constraints

**REQ-SV-028**: **WHERE** the browser does not support ResizeObserver API, **the system SHALL** gracefully degrade to tab-only mode.

**REQ-SV-029**: **WHERE** the total number of active terminal sessions exceeds 4, **the system SHALL** limit split view to the 4 most recently accessed sessions.

## Implementation Phasing

### Phase 1: Basic 2-Way Splits
**REQ-SV-030**: **WHERE** implementing split views, **the system SHALL** initially support only 2-way splits (horizontal and vertical).

**REQ-SV-031**: **WHERE** Phase 1 is complete, **the system SHALL** provide a stable foundation for:
- Single divider management
- Focus switching between 2 terminals
- Basic keyboard navigation
- Responsive collapse to tabs

### Phase 2: Quad View (Quick Follow-on)
**REQ-SV-032**: **WHERE** 2-way splits are stable, **the system SHALL** extend support to 4-way quad view (2x2 grid).

**REQ-SV-033**: **WHERE** implementing quad view, **the system SHALL** reuse the existing split infrastructure with minimal architectural changes.

## Dependencies

- Multi-terminal tabs feature must be completed and stable
- Frontend must support multiple concurrent xterm.js instances
- Backend must handle multiple concurrent WebSocket connections per task
- Shelltender must support session state broadcasting for all active terminals