# Claude Session Tracking Requirements

## Overview
Enable PocketDev to capture and track Claude Code session IDs using Claude's SessionStart hook mechanism, providing visibility into AI agent sessions within the PocketDev terminal infrastructure.

## Requirements

### Functional Requirements

**REQ-CST-001**: WHEN a Claude session starts in a PocketDev terminal, the system SHALL capture the Claude session ID via the SessionStart hook.

**REQ-CST-002**: The system SHALL store agent session information including terminal session ID, agent type, agent session ID, and metadata.

**REQ-CST-003**: WHEN multiple Claude sessions are started in the same terminal, the system SHALL track all sessions with their start times.

**REQ-CST-004**: The system SHALL update the current agent session reference in the terminal session record for quick access.

**REQ-CST-005**: IF the SessionStart hook fails to update the database, the system SHALL log the error but not block Claude execution.

**REQ-CST-006**: The system SHALL support tracking sessions from multiple agent types (claude, aider, codex, gemini) using the same data structure.

### Data Requirements

**REQ-CST-007**: The system SHALL create an `agent_sessions` table with fields: id, terminal_session_id, agent_type, agent_session_id, created_at, and metadata (JSON).

**REQ-CST-008**: The system SHALL add a `current_agent_session_id` field to the `terminal_sessions` table.

**REQ-CST-009**: WHEN querying agent sessions, the system SHALL provide efficient lookups by terminal session ID and agent session ID via indexes.

### Integration Requirements

**REQ-CST-010**: The SessionStart hook SHALL read the `DB_SESSION_ID` environment variable to identify the PocketDev terminal session.

**REQ-CST-011**: The hook SHALL make an HTTP API call to update the PocketDev backend with the Claude session information.

**REQ-CST-012**: WHERE the hook cannot connect to the API, it SHALL fail silently and return success to Claude.

### WebSocket Requirements

**REQ-CST-013**: WHEN an agent session is created or updated, the system SHALL broadcast the update via WebSocket to connected clients.

**REQ-CST-014**: The WebSocket event SHALL include the terminal session ID and new agent session information.

## Out of Scope
- Backward compatibility with existing sessions
- Security/authentication for hook API calls
- Session end time tracking
- Agent session analytics/reporting
- Modification of existing Claude launch commands

## Migration Approach
A one-time migration script will:
1. Add the new database tables and columns
2. Set existing active Claude sessions to have `agent_type = 'claude'` where detectable
3. Leave historical data unchanged

## Success Criteria
- Claude sessions are automatically tracked without user intervention
- Session IDs are visible in the PocketDev UI
- Multiple Claude sessions per terminal are properly tracked
- System remains extensible for other AI agents