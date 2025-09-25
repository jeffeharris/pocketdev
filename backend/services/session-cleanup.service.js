/**
 * Session Cleanup Service
 *
 * Orchestrates cleanup of orphaned Shelltender sessions and database synchronization
 * Uses TerminalService for all data access and operations (proper service layer pattern)
 */

export class SessionCleanupService {
  constructor(terminalService) {
    this.terminalService = terminalService;
    this.cleanupInterval = null;
  }

  /**
   * Start periodic cleanup job
   */
  start() {
    // Run cleanup on startup
    this.performCleanup().catch(console.error);

    // Schedule periodic cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.performCleanup().catch(console.error);
    }, 5 * 60 * 1000);

    console.log('[SessionCleanupService] Started periodic session cleanup');
  }

  /**
   * Stop cleanup job
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Perform session cleanup
   */
  async performCleanup() {
    console.log('[SessionCleanupService] Starting session cleanup...');

    try {
      // 1. Get all active sessions from database
      const dbSessions = await this.terminalService.getActiveSessions();

      // 2. Get all sessions from Shelltender
      const shelltenderSessions = await this.terminalService.getShelltenderSessions();
      const shelltenderSessionIds = new Set(shelltenderSessions.map(s => s.id));

      // 3. Find database sessions without corresponding Shelltender sessions
      const deadSessions = dbSessions.filter(
        session => session.shelltender_session_id && !shelltenderSessionIds.has(session.shelltender_session_id)
      );

      // 4. Mark dead sessions as inactive
      for (const session of deadSessions) {
        console.log(`[SessionCleanupService] Marking session ${session.id} as inactive (Shelltender session not found)`);
        await this.terminalService.markSessionInactive(session.id);
      }

      // 5. Find Shelltender sessions without database records (orphaned)
      const dbSessionIds = new Set(dbSessions.map(s => s.shelltender_session_id).filter(Boolean));
      const orphanedSessions = shelltenderSessions.filter(
        session => !dbSessionIds.has(session.id)
      );

      // 6. Terminate orphaned Shelltender sessions
      for (const session of orphanedSessions) {
        console.log(`[SessionCleanupService] Terminating orphaned Shelltender session: ${session.id}`);
        await this.terminalService.terminateShelltenderSession(session.id);
      }

      console.log(`[SessionCleanupService] Cleanup complete. Marked ${deadSessions.length} sessions inactive, terminated ${orphanedSessions.length} orphaned sessions`);
    } catch (error) {
      console.error('[SessionCleanupService] Error during cleanup:', error);
    }
  }

  /**
   * Clean up sessions for deleted tasks
   */
  async cleanupDeletedTaskSessions() {
    try {
      // Get all active sessions
      const sessions = await this.terminalService.getActiveSessions();

      // Group by task ID
      const taskIds = [...new Set(sessions.map(s => s.task_id))];

      // Check which tasks still exist
      for (const taskId of taskIds) {
        const taskExists = await this.terminalService.taskExists(taskId);
        if (!taskExists) {
          console.log(`[SessionCleanupService] Task ${taskId} not found, cleaning up sessions`);

          // Get all sessions for this deleted task
          const taskSessions = sessions.filter(s => s.task_id === taskId);

          // Terminate and delete each session
          for (const session of taskSessions) {
            if (session.shelltender_session_id) {
              await this.terminalService.terminateShelltenderSession(session.shelltender_session_id);
            }
            await this.terminalService.deleteSessionRecord(session.id);
          }
        }
      }
    } catch (error) {
      console.error('[SessionCleanupService] Error cleaning up deleted task sessions:', error);
    }
  }
}