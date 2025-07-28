# Session Lifecycle Design

## Current State
Currently, sessions have only two states:
- **Active** (`is_active = 1`) - Session is running and visible
- **Deleted** - Session is removed from database entirely

## Problems with Current Approach
1. No way to temporarily hide/suspend sessions
2. No session history or archival
3. Closing a tab loses all context permanently
4. No way to restore accidentally closed tabs

## Proposed Session Lifecycle States

### 1. Active
- Session is running in Shelltender
- Terminal is visible in UI
- Consumes resources (memory, CPU)
- Default state when creating new session

### 2. Suspended
- Session exists in database but not in Shelltender
- Terminal hidden from UI unless user chooses to show suspended tabs
- Preserves:
  - Tab name and order
  - AI agent type
  - Last AI state
  - Session metadata
  - Command history reference
- Can be resumed to Active state
- Automatically suspend after N minutes of inactivity (configurable)

### 3. Archived
- Long-term storage for completed sessions
- Not resumable but viewable
- Preserves full session transcript
- Useful for:
  - Reviewing past work
  - Compliance/audit trails
  - Learning from previous sessions
- Auto-archive suspended sessions after N days

### 4. Deleted
- Permanent removal
- Cleans up all associated data
- Not recoverable

## Implementation Plan

### Database Changes
```sql
ALTER TABLE terminal_sessions 
ADD COLUMN state VARCHAR(20) DEFAULT 'active' 
CHECK (state IN ('active', 'suspended', 'archived'));

-- Index for efficient queries
CREATE INDEX idx_terminal_sessions_state ON terminal_sessions(state);

-- Add timestamps for state transitions
ALTER TABLE terminal_sessions
ADD COLUMN suspended_at TIMESTAMP,
ADD COLUMN archived_at TIMESTAMP;
```

### UI Changes
1. **Tab Close Behavior**:
   - Default: Suspend (not delete)
   - Shift+Click: Delete permanently
   - Show confirmation for permanent deletion

2. **Suspended Tabs UI**:
   - Add dropdown/panel showing suspended sessions
   - "Resume" button to reactivate
   - Grayed out appearance
   - Shows time since suspension

3. **Tab Context Menu**:
   - Close (Suspend)
   - Delete Permanently
   - Archive Now
   - View History

### API Changes
```typescript
// New endpoints
POST   /api/sessions/:id/suspend
POST   /api/sessions/:id/resume
POST   /api/sessions/:id/archive
GET    /api/tasks/:id/sessions?state=suspended
GET    /api/tasks/:id/sessions?state=archived

// Modified behavior
DELETE /api/sessions/:id  // Now suspends by default
DELETE /api/sessions/:id?permanent=true  // Force delete
```

### Benefits
1. **Accident Prevention**: Can't accidentally lose work
2. **Resource Management**: Suspend inactive sessions to save resources
3. **History Tracking**: Review past sessions for learning/audit
4. **Better UX**: Users can manage many sessions without clutter

## Migration Strategy
1. Add new columns with defaults (non-breaking)
2. Update backend to respect states
3. Add UI for suspended sessions
4. Gradual rollout with feature flag

## Future Enhancements
1. **Session Templates**: Save session as template for reuse
2. **Session Branching**: Fork a session to try different approaches
3. **Session Sharing**: Share read-only session transcripts
4. **Auto-suspend Policy**: Configurable per project/user