# Session Management Requirements for Multi-Terminal Tabs

<!-- Document Metadata
Created: 2025-07-28
Modified: 2025-07-28
Status: ????
-->


## Overview
This document defines requirements for proper Shelltender session management, tab persistence, and naming in EARS (Easy Approach to Requirements Syntax) format.

## Requirements

### Session Naming and Identity

**REQ-001**: The system SHALL generate a stable session identifier for each terminal tab using the format `task-{taskId}-{dbSessionId}`.

**REQ-002**: WHEN a new terminal tab is created, the system SHALL generate a unique database session ID that persists for the lifetime of that tab.

**REQ-003**: The system SHALL use the database session ID as the primary identifier for both Shelltender sessions and frontend tab tracking.

### Tab Persistence

**REQ-004**: WHEN a user refreshes the page, the system SHALL restore all previously open terminal tabs for the current task.

**REQ-005**: The system SHALL persist the following tab properties in the database:
- Tab name
- Tab order
- AI agent type
- Database session ID
- Associated Shelltender session ID

**REQ-006**: WHEN restoring tabs after a page reload, the system SHALL maintain the same tab order as before the reload.

### Session Reconnection

**REQ-007**: WHEN loading a terminal tab, the system SHALL first check if a Shelltender session exists with the expected session ID.

**REQ-008**: IF a Shelltender session exists for a tab, the system SHALL reconnect to that existing session INSTEAD OF creating a new one.

**REQ-009**: IF a Shelltender session does not exist for a tab, the system SHALL create a new session with the stable session ID AND update the database record.

**REQ-010**: The system SHALL handle Shelltender session lifecycle events:
- Session exists and is active → Reconnect
- Session exists but is inactive → Attempt to reactivate or create new
- Session does not exist → Create new with same ID

### Tab Renaming

**REQ-011**: WHEN a user double-clicks on a tab name, the system SHALL enable inline editing of the tab name.

**REQ-012**: WHEN a user completes editing a tab name, the system SHALL:
- Update the tab name in the database
- Update the tab name in the UI
- Broadcast the change via WebSocket to other connected clients

**REQ-013**: The system SHALL validate tab names to ensure they are:
- Non-empty
- Maximum 50 characters
- Unique within the task (optional, for better UX)

### Session Cleanup

**REQ-014**: WHEN a user explicitly closes a tab, the system SHALL:
- Mark the database session as inactive
- Terminate the associated Shelltender session
- Remove the tab from the UI

**REQ-015**: The system SHALL provide a cleanup mechanism to remove orphaned Shelltender sessions that no longer have active database records.

**REQ-016**: WHEN a task is deleted, the system SHALL terminate all associated Shelltender sessions.

### State Synchronization

**REQ-017**: The system SHALL maintain consistency between:
- Database terminal_sessions records
- Active Shelltender sessions
- Frontend tab state

**REQ-018**: IF a Shelltender session unexpectedly terminates, the system SHALL:
- Detect the termination
- Update the database record
- Notify the user in the UI
- Offer to create a new session

## Implementation Notes

### Database Schema Considerations
- The `terminal_sessions` table already has most required fields
- The `session_id` field should store the Shelltender session ID
- The `id` field (database session ID) should be used in the stable session naming

### Session ID Format
- Current (problematic): `task-{taskId}-{timestamp}`
- Proposed (stable): `task-{taskId}-{dbSessionId}`
- Example: `task-3d36b64f-a1b2c3d4`

### Reconnection Flow
1. Frontend loads task with terminal tabs
2. For each tab, check if Shelltender session exists
3. If exists, reconnect using the Terminal component's sessionId prop
4. If not exists, create new session with the stable ID
5. Update database with actual Shelltender session status

### Benefits
- Dramatically reduces Shelltender session count
- Preserves terminal history and state across reloads
- Enables true multi-tab workflow
- Reduces resource consumption
- Improves user experience