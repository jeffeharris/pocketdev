# Terminal Mounting Strategy Requirements

<!-- Document Metadata
Created: 2025-07-31
Modified: 2025-07-31
Status: ????
-->


## Overview
Keep terminal sessions mounted in the DOM to prevent connection drops when switching between split view layouts.

## Requirements (EARS Format)

### REQ-TMS-001: Persistent Terminal Mounting
**The system shall** render all terminal sessions for a task in the DOM at all times while the task is active.
- **Rationale**: Prevents WebSocket disconnections and terminal state loss
- **Priority**: High
- **Acceptance**: Terminal connections remain active when switching between tab/split/quad layouts

### REQ-TMS-002: CSS-Based Visibility
**The system shall** use CSS display property to show/hide terminals based on current layout.
- **Rationale**: Simpler than complex visibility management
- **Priority**: High
- **Acceptance**: Terminals use `display: none` when hidden, `display: block` when visible

### REQ-TMS-003: Layout-Based Display Logic
**When** the layout mode changes, **the system shall** update terminal visibility without remounting components.
- **Rationale**: Maintains connection stability
- **Priority**: High
- **Acceptance**: No React component unmounting during layout switches

### REQ-TMS-004: Minimal Code Changes
**The system shall** implement persistent mounting with minimal changes to existing components.
- **Rationale**: Reduce complexity and testing surface
- **Priority**: Medium
- **Acceptance**: Implementation requires < 200 lines of code changes

### REQ-TMS-005: Tab Mode Single Terminal
**When** in tab mode, **the system shall** display only the active terminal while keeping others hidden.
- **Rationale**: Consistent with current UX
- **Priority**: High
- **Acceptance**: Only one terminal visible in tab mode

### REQ-TMS-006: Split Mode Terminal Display
**When** in split mode, **the system shall** display terminals assigned to primary and secondary slots.
- **Rationale**: Show assigned terminals in their positions
- **Priority**: High
- **Acceptance**: Correct terminals appear in split positions

## Success Criteria
1. Zero connection drops when switching layouts
2. No visible performance degradation
3. Existing functionality preserved
4. Simple, maintainable implementation