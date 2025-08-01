# Task and Session Lifecycle Management Requirements

## Desired Outcome Statement

The PocketDev system shall provide comprehensive lifecycle management for tasks and terminal sessions that enables users to efficiently manage their AI-assisted development workflows through clear state transitions, preserves valuable work context across sessions, supports recovery from interruptions, and maintains clean separation between task management (git branches/worktrees) and session management (AI terminal contexts), while ensuring no work is lost and all resources are properly cleaned up when no longer needed.

## Requirements

### Task Lifecycle Requirements

#### REQ-TSL-001: Task State Definition
**When** a task exists in the system, **the system shall** maintain one of the following states: draft, active, paused, completed, merged, archived, or deleted.

#### REQ-TSL-002: Task Creation
**When** a user creates a new task, **the system shall** initialize it in the 'draft' state if no branch is specified, or 'active' state if a branch is created.

#### REQ-TSL-003: Task State Transitions
**When** a user or system event triggers a state change, **the system shall** only allow the following transitions:
- draft → active (when branch is created)
- active → paused (when work is suspended)
- active → completed (when work is finished)
- paused → active (when work resumes)
- completed → merged (when merged to base)
- completed → active (when more work needed)
- merged → archived (when cleaning up)
- any state → archived (when soft deleting)
- archived → active (when restoring within 30 days)
- archived → deleted (after 30 days or forced)

#### REQ-TSL-004: Task Archival
**When** a user archives a task, **the system shall** move the git worktree to a timestamped archive location, preserve all task metadata, mark the task as archived, and suspend all active terminal sessions.

#### REQ-TSL-005: Task Restoration
**When** a user restores an archived task within 30 days, **the system shall** restore the git worktree to the active location, update the task state to its pre-archive state, and allow resumption of suspended sessions.

#### REQ-TSL-006: Task Deletion
**When** a user deletes a task with force=true or after 30 days archived, **the system shall** permanently remove the git worktree, archive all terminal sessions, delete the task record, and clean up the worktree registry.

#### REQ-TSL-007: Task Branch Management
**When** a task is active, **the system shall** maintain an isolated git worktree with its own branch that can be pushed, pulled, and merged independently of other tasks.

#### REQ-TSL-008: Task Merge Tracking
**When** a task branch is merged into the base branch, **the system shall** record the merge commit SHA, timestamp, and update the task state to 'merged'.

#### REQ-TSL-009: Post-Merge Activity Detection
**When** commits are made to a merged task, **the system shall** detect and flag the task as having post-merge activity that may need re-merging.

### Terminal Session Lifecycle Requirements

#### REQ-TSL-010: Session State Definition
**When** a terminal session exists, **the system shall** maintain one of the following states: active, suspended, archived, or terminated.

#### REQ-TSL-011: Session Creation
**When** a terminal session is created for a task, **the system shall** initialize it in the 'active' state with a unique identifier and associate it with the task's worktree path.

#### REQ-TSL-012: Session Suspension
**When** a task is paused or archived, **the system shall** suspend all active sessions by saving their state to the database and removing them from Shelltender while preserving context for resumption.

#### REQ-TSL-013: Session Resumption
**When** a suspended session is resumed, **the system shall** restore the session in Shelltender with its previous working directory and environment state.

#### REQ-TSL-014: Session Archival
**When** a session is no longer needed but should be preserved, **the system shall** save the complete session transcript, metadata, and final state to long-term storage.

#### REQ-TSL-015: Session Termination
**When** a task is permanently deleted, **the system shall** terminate all associated sessions after archiving any valuable context.

#### REQ-TSL-016: Multi-Session Support
**When** multiple terminal sessions exist for a task, **the system shall** track each session independently with its own state, tab name, and AI agent context.

#### REQ-TSL-017: Session Activity Tracking
**When** a session is active, **the system shall** track the AI state (not-started, idle, working, waiting) and update timestamps for last activity.

### Lifecycle Event Requirements

#### REQ-TSL-018: Event Logging
**When** any lifecycle state transition occurs, **the system shall** record an event with timestamp, actor, previous state, new state, and optional reason.

#### REQ-TSL-019: Event Broadcasting
**When** a lifecycle event occurs, **the system shall** broadcast the change via WebSocket to update all connected clients in real-time.

#### REQ-TSL-020: Event History
**When** viewing a task or session, **the system shall** provide access to the complete lifecycle event history for audit and debugging purposes.

### Resource Management Requirements

#### REQ-TSL-021: Worktree Cleanup
**When** a task is deleted, **the system shall** remove the git worktree using proper git commands to avoid corrupting the repository.

#### REQ-TSL-022: Session Resource Limits
**When** terminal sessions accumulate, **the system shall** enforce limits on active sessions per task (maximum 6) and total session storage per task.

#### REQ-TSL-023: Orphan Detection
**When** the system starts or periodically, **the system shall** detect orphaned worktrees and sessions that lack parent tasks and flag them for cleanup.

#### REQ-TSL-024: Storage Management
**When** archived content exceeds retention limits, **the system shall** automatically purge oldest archived tasks and sessions according to configurable retention policies.

### User Interface Requirements

#### REQ-TSL-025: State Visualization
**When** displaying tasks, **the system shall** clearly indicate the current state with appropriate colors and icons matching the design system.

#### REQ-TSL-026: Action Availability
**When** showing task actions, **the system shall** only display actions valid for the current state (e.g., can't merge a draft task).

#### REQ-TSL-027: Bulk Operations
**When** managing multiple tasks, **the system shall** support bulk operations for archiving, deleting, and state transitions with appropriate confirmations.

#### REQ-TSL-028: Recovery Options
**When** viewing archived items, **the system shall** display the time remaining for restoration and provide clear restore/permanent delete options.

### Integration Requirements

#### REQ-TSL-029: Git Integration
**When** performing lifecycle operations, **the system shall** maintain git repository integrity and handle git operations atomically with proper error recovery.

#### REQ-TSL-030: Shelltender Coordination
**When** managing sessions, **the system shall** coordinate with Shelltender to ensure terminal processes are properly created, suspended, resumed, and terminated.

#### REQ-TSL-031: Database Consistency
**When** performing lifecycle transitions, **the system shall** ensure database transactions maintain referential integrity between tasks, sessions, and worktrees.

#### REQ-TSL-032: Webhook Notifications
**When** significant lifecycle events occur, **the system shall** support webhook notifications for external integrations (future requirement).

### Performance Requirements

#### REQ-TSL-033: State Transition Speed
**When** transitioning states, **the system shall** complete the operation within 2 seconds for single tasks and 10 seconds for bulk operations.

#### REQ-TSL-034: Recovery Time
**When** restoring an archived task, **the system shall** complete the restoration within 5 seconds excluding git operations.

#### REQ-TSL-035: Cleanup Efficiency
**When** cleaning up resources, **the system shall** perform cleanup operations asynchronously without blocking user operations.

### Data Preservation Requirements

#### REQ-TSL-036: Work Preservation
**When** archiving or suspending, **the system shall** preserve all uncommitted changes, session history, and task metadata for recovery.

#### REQ-TSL-037: Deletion Confirmation
**When** permanently deleting tasks with uncommitted work, **the system shall** require explicit confirmation and display what will be lost.

#### REQ-TSL-038: Export Capability
**When** deleting or archiving, **the system shall** offer the option to export task branches, session transcripts, and metadata before removal.

## Implementation Priority

1. **Phase 1**: Core state machines and transitions (REQ-TSL-001 through REQ-TSL-009)
2. **Phase 2**: Session lifecycle management (REQ-TSL-010 through REQ-TSL-017)
3. **Phase 3**: Event system and UI updates (REQ-TSL-018 through REQ-TSL-028)
4. **Phase 4**: Resource management and cleanup (REQ-TSL-021 through REQ-TSL-024)
5. **Phase 5**: Advanced features and optimizations (REQ-TSL-029 through REQ-TSL-038)

## Success Criteria

- No work is lost due to lifecycle transitions
- Users can confidently pause and resume work across sessions
- System resources are efficiently managed without manual intervention
- Task and session states are always consistent and clearly communicated
- Recovery from mistakes is possible within reasonable time limits