# Task Archive System Requirements

## Overview
The task archive system provides a way to soft-delete tasks while preserving their data for potential restoration. This spec defines the complete lifecycle and storage management for archived tasks.

## Current State
- Tasks can be archived via DELETE endpoint with `softDelete=true`
- Entire worktrees are moved to `.archived/` directory
- Sessions are immediately killed on archive
- No automatic cleanup of old archives
- Storage grows unbounded

## Requirements

### Functional Requirements

#### FR1: Archive Operation
- **FR1.1**: Archive task via DELETE endpoint with `softDelete=true` parameter
- **FR1.2**: Set `is_archived = true` in database
- **FR1.3**: Move worktree to `.archived/{project-id}-task-{task-id}-{timestamp}/`
- **FR1.4**: Preserve all uncommitted changes, untracked files, and local state
- **FR1.5**: Emit `task-state-changed` event for real-time UI updates

#### FR2: Session Handling
- **FR2.1**: Do NOT kill terminal sessions on archive
- **FR2.2**: Allow Shelltender to manage session idling automatically
- **FR2.3**: Kill sessions only on permanent deletion (after retention period)
- **FR2.4**: Preserve session IDs with archived task for potential restoration

#### FR3: Storage Management
- **FR3.1**: Implement 30-day retention period for archived tasks
- **FR3.2**: Automatic cleanup of archives older than retention period
- **FR3.3**: Manual cleanup option via admin interface
- **FR3.4**: Storage monitoring and alerts when threshold exceeded

#### FR4: Restoration
- **FR4.1**: Restore archived task within retention period
- **FR4.2**: Move worktree back to active location
- **FR4.3**: Reconnect to existing sessions if still available
- **FR4.4**: Set `is_archived = false` in database

#### FR5: UI Transparency
- **FR5.1**: Show archive storage impact in UI (size of archived data)
- **FR5.2**: Display retention period countdown
- **FR5.3**: Warn users about full project copies being stored
- **FR5.4**: Provide restore button for archived tasks

### Non-Functional Requirements

#### NFR1: Performance
- **NFR1.1**: Archive operation should complete within 5 seconds
- **NFR1.2**: Cleanup should not block other operations
- **NFR1.3**: Storage checks should be cached (5-minute TTL)

#### NFR2: Storage Optimization
- **NFR2.1**: Consider differential storage (only task changes, not full worktree)
- **NFR2.2**: Compress archives after 7 days
- **NFR2.3**: Monitor storage growth trends

#### NFR3: Reliability
- **NFR3.1**: Archive operations must be atomic (all-or-nothing)
- **NFR3.2**: Cleanup must verify task age before deletion
- **NFR3.3**: Maintain audit log of archive/restore/delete operations

## User Stories

### US1: Archive a Task
**As a** developer  
**I want to** archive a completed or abandoned task  
**So that** I can clean up my workspace while preserving the option to restore it

**Acceptance Criteria:**
- Task disappears from active task list
- Task appears in archived section
- Terminal sessions remain accessible
- Confirmation message shows retention period

### US2: Restore an Archived Task
**As a** developer  
**I want to** restore an archived task  
**So that** I can continue work or reference previous implementation

**Acceptance Criteria:**
- Task returns to active list
- All files and changes are preserved
- Terminal sessions reconnect if available
- Git worktree is functional

### US3: Monitor Archive Storage
**As an** administrator  
**I want to** see how much storage archives are consuming  
**So that** I can manage disk space effectively

**Acceptance Criteria:**
- Dashboard shows total archive size
- Per-project archive breakdown available
- Alert when storage exceeds threshold
- Option to manually trigger cleanup

## Implementation Phases

### Phase 1: Fix Immediate Issues (P1)
1. Fix archive endpoint 404 error ✅
2. Document current behavior
3. Add storage monitoring endpoint

### Phase 2: Session Preservation (P2)
1. Modify archive to not kill sessions
2. Track session IDs with archived tasks
3. Update cleanup to kill sessions after 30 days

### Phase 3: Automatic Cleanup (P2)
1. Implement cleanup service
2. Add cron job or scheduled task
3. Add admin UI for manual cleanup

### Phase 4: Storage Optimization (P3)
1. Research differential storage options
2. Implement compression for old archives
3. Consider git bundle format for efficiency

### Phase 5: UI Transparency (P3)
1. Add archive storage indicators
2. Show retention countdown
3. Implement restore functionality
4. Add archive management page

## Success Metrics
- Archive operations complete within 5 seconds
- Storage growth rate reduced by 50%
- Zero data loss from archive/restore operations
- User confusion about archive behavior eliminated

## Related Issues
- BUG-025: Archive Storage Grows Unbounded
- UX-008: Archive System Transparency
- BUG-017: Session ID Management (affects session preservation)

## Open Questions
1. Should we implement differential storage immediately or wait for storage issues?
2. Should archives be project-specific or global?
3. Should we allow custom retention periods per project?
4. How should we handle archives when a project is deleted?

## References
- Current implementation: `backend/services/task.service.js:117-156`
- Cleanup script: `scripts/cleanup-archived.sh`
- Frontend service: `frontend/src/services/task.service.ts:277-288`