# BUG-023: Archive Storage Grows Unbounded

## Problem
The task archive system stores complete project worktrees indefinitely with no automatic cleanup, leading to unbounded storage growth.

## Current Behavior
- Archiving a task moves the **entire worktree** to `.archived/` directory
- Each archive contains the full project source code (100MB+ per task)
- No automatic cleanup despite "30 days" messaging
- Shell sessions are immediately killed instead of idled
- Manual cleanup script exists but isn't scheduled

## Impact
- **Storage**: 10 archived tasks of a 100MB project = 1GB of redundant data
- **UX**: Users lose terminal session history when archiving
- **Operations**: Manual intervention required to prevent disk full

## Evidence
- `backend/services/task.service.js:138-144` - Full worktree is moved
- `scripts/cleanup-archived.sh` - Manual only, no cron configured
- `backend/services/session-cleanup.service.js` - Only cleans orphaned sessions, not archives

## Proposed Solutions

### Immediate (P1)
1. Schedule the cleanup script via cron
2. Add storage monitoring/alerts

### Short-term (P2)
1. Idle sessions instead of killing them on archive
2. Add archive management API endpoints
3. Implement restoration time limits

### Long-term (P3)
1. Store only task-specific changes, not full worktrees
2. Use git bundles or patches for efficient storage
3. Implement progressive cleanup (compress → archive → delete)

## Related Issues
- BUG-017: Session ID management (affects session preservation)
- BUG-019: WebSocket complexity (affects session state updates)

## Questions to Resolve
- What data in archived worktrees can't be restored from git?
- Should uncommitted changes be preserved differently?
- Can Shelltender sessions be idled via API?