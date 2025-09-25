# Analytics Architecture Review - Multi-Terminal Sessions

<!-- Document Metadata
Created: 2025-07-28
Modified: 2025-07-28
Status: ????
-->


## Current State

### What We Track Today

1. **Terminal Session Data** (in `terminal_sessions` table)
   - Session start/end times
   - AI state transitions (not-started → idle → working → waiting)
   - Last activity timestamp
   - Total time in each state (stored but not calculated)
   - Worktree path and session IDs

2. **Task-Level Metrics** (partially implemented)
   - Task creation/completion times
   - Git operations count
   - Number of commits per task

3. **Real-time State** (via WebSocket)
   - AI state changes broadcast immediately
   - No persistence of state history
   - No event log or audit trail

### Current Limitations

1. **No Historical State Data**
   - Only current state is stored
   - State transitions are lost
   - Can't reconstruct session timeline

2. **No Command Tracking**
   - Terminal commands not logged
   - AI prompts/responses not captured
   - File operations not tracked

3. **No Aggregation Layer**
   - Raw data only, no rollups
   - No cross-session analytics
   - No performance metrics

4. **No Token/Cost Tracking**
   - AI usage not measured
   - No cost attribution per session
   - No budget controls

## Desired State

### Core Analytics Features

1. **Session Timeline Tracking**
   ```sql
   CREATE TABLE session_events (
     id INTEGER PRIMARY KEY,
     session_id VARCHAR(255),
     event_type VARCHAR(50), -- state_change, command, file_edit, etc.
     event_data JSON,
     timestamp DATETIME,
     duration_ms INTEGER
   );
   ```

2. **Command & AI Interaction Logging**
   - Capture all commands sent to terminal
   - Log AI prompts and response metadata
   - Track file operations initiated by AI

3. **Performance Metrics**
   - Time to first AI response
   - Average response time per session
   - Files changed per session
   - Commands executed per session

4. **Cost Tracking**
   - Estimate tokens from prompt/response length
   - Track cost per session/tab/task
   - Budget alerts and limits

5. **Aggregated Views**
   - Hourly/daily rollups
   - Per-task summaries
   - AI agent comparison metrics

### Analytics Dashboard Requirements

1. **Session View**
   - Timeline visualization of session activity
   - State duration breakdown
   - Command frequency heatmap

2. **Task Analytics**
   - Total AI time per task
   - Cost per task
   - Productivity metrics (files changed, commits)

3. **Multi-Tab Insights**
   - Concurrent session patterns
   - Tab switching frequency
   - Most productive tab configurations

## Implementation Approach

### Phase 1: Event Logging Infrastructure (8-12 hours)
1. Create `session_events` table
2. Modify AI session monitor to log all state changes
3. Add command interceptor to Shelltender integration
4. Create event service for consistent logging

### Phase 2: Basic Analytics API (6-8 hours)
1. Session timeline endpoint
2. Basic aggregation queries
3. Cost estimation logic
4. RESTful analytics endpoints

### Phase 3: Frontend Dashboard (10-12 hours)
1. Session timeline component
2. Metrics cards and charts
3. Tab analytics view
4. Export functionality

### Phase 4: Advanced Features (8-10 hours)
1. Real-time metrics updates
2. Alerting system
3. Budget controls
4. Historical comparisons

## Level of Effort Summary

**Total Estimated Effort: 32-42 hours**

### Quick Wins (Can implement now with multi-tab work):
1. **Add event logging hooks** (~2 hours)
   - Instrument existing state changes
   - Add session_id to all events
   - Create events table

2. **Track tab lifecycle** (~1 hour)
   - Log tab creation/close
   - Track active tab time
   - Count tab switches

3. **Basic metrics endpoint** (~3 hours)
   - Session duration
   - Commands per session
   - Active/idle time ratio

### Architecture Benefits
- Current WebSocket infrastructure supports real-time analytics
- SQLite can handle analytics workload for single user
- Event-driven design makes it extensible

### Risks & Considerations
1. **Storage Growth**: Event log could grow large
   - Mitigation: Implement retention policy
2. **Performance Impact**: Logging overhead
   - Mitigation: Async event processing
3. **Privacy**: Logging commands/prompts
   - Mitigation: Configurable privacy levels

## Recommendation

Start with basic event logging during multi-tab implementation. This adds minimal overhead but provides foundation for future analytics. The event log will be invaluable for debugging multi-session scenarios and understanding usage patterns.