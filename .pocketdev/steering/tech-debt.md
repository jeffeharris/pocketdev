# PocketDev Tech Debt Tracker

This document tracks technical debt items that should be addressed in future iterations.

## AI Session Monitoring (Shelltender v0.6.1)

**Date Added:** 2025-07-18  
**Priority:** Medium  
**Component:** Backend/Monitoring

### Current Issues

1. **Error Handling & Resilience**
   - Session monitor silently retries connections every 5 seconds
   - Should implement exponential backoff and max retry limits
   - No alerts when connections fail repeatedly

2. **Debug Logging**
   - Remove `[DEBUG] Output from...` logging in production (line 54 of shelltender-session-monitor.js)
   - Add proper log levels and configuration

3. **Session Lifecycle Management**
   - When tasks are deleted/completed, WebSocket connections aren't explicitly closed
   - Could lead to resource leaks with many completed tasks
   - Need to hook into task deletion events

4. **Connection Scaling**
   - Each task opens its own WebSocket connection
   - Could be resource-intensive with many concurrent tasks
   - Consider connection pooling or batching

5. **Monitoring & Metrics**
   - No visibility into connection health
   - No metrics for pattern match performance
   - No tracking of message rates or failures

6. **Architecture Documentation**
   - The switch from global monitoring to per-session connections is a significant change
   - Need to document why v0.6.1 requires this approach
   - Migration guide for future Shelltender updates

### Proposed Solutions

1. **Implement connection manager with:**
   - Exponential backoff (1s, 2s, 4s, 8s, max 30s)
   - Max retry limit (10 attempts)
   - Alert mechanism after max retries

2. **Add proper logging:**
   ```javascript
   const logger = createLogger({ level: process.env.LOG_LEVEL || 'info' });
   ```

3. **Hook into task lifecycle:**
   ```javascript
   wsEventService.on('task-deleted', (taskId) => {
     sessionMonitor.closeSession(`task-${taskId}`);
   });
   ```

4. **Connection pooling research:**
   - Investigate if Shelltender v0.7+ will support multiplexing
   - Consider implementing a connection limit (max 50 concurrent)

5. **Add monitoring dashboard:**
   - Connection status per task
   - Message rates and pattern matches/second
   - Failed connection attempts

### Impact
- **Performance:** Medium - Resource usage scales with task count
- **Reliability:** High - Silent failures could miss AI state updates
- **Maintainability:** Medium - Current implementation is straightforward but fragile

### References
- Original issue investigation: Backend monitoring broke after Shelltender v0.6.1 upgrade
- New implementation: `/backend/shelltender-session-monitor.js`
- Documentation: `/docs/shelltender/MONITORING_v0.6.1.md`