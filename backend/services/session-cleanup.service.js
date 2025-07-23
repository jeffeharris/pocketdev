/**
 * Session Cleanup Service
 * 
 * Handles cleanup of orphaned Shelltender sessions and database synchronization
 */

export class SessionCleanupService {
  constructor(db, models) {
    this.db = db;
    this.models = models;
    this.shelltenderUrl = process.env.SHELLTENDER_API_URL || 'http://shelltender:8080';
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
      const dbSessions = await this.models.sessions.findAll({ isActive: true });
      
      // 2. Get all sessions from Shelltender
      const shelltenderSessions = await this.getShelltenderSessions();
      const shelltenderSessionIds = new Set(shelltenderSessions.map(s => s.id));
      
      // 3. Find database sessions without corresponding Shelltender sessions
      const deadSessions = dbSessions.filter(
        session => session.shelltender_session_id && !shelltenderSessionIds.has(session.shelltender_session_id)
      );
      
      // 4. Mark dead sessions as inactive
      for (const session of deadSessions) {
        console.log(`[SessionCleanupService] Marking session ${session.id} as inactive (Shelltender session not found)`);
        await this.models.sessions.markInactive(session.id);
      }
      
      // 5. Find Shelltender sessions without database records (orphaned)
      const dbSessionIds = new Set(dbSessions.map(s => s.shelltender_session_id).filter(Boolean));
      const orphanedSessions = shelltenderSessions.filter(
        session => session.id.startsWith('task-') && !dbSessionIds.has(session.id)
      );
      
      // 6. Terminate orphaned Shelltender sessions
      for (const session of orphanedSessions) {
        console.log(`[SessionCleanupService] Terminating orphaned Shelltender session: ${session.id}`);
        await this.terminateShelltenderSession(session.id);
      }
      
      console.log(`[SessionCleanupService] Cleanup complete. Marked ${deadSessions.length} sessions inactive, terminated ${orphanedSessions.length} orphaned sessions`);
    } catch (error) {
      console.error('[SessionCleanupService] Error during cleanup:', error);
    }
  }

  /**
   * Get all sessions from Shelltender
   */
  async getShelltenderSessions() {
    try {
      const response = await fetch(`${this.shelltenderUrl}/api/sessions`);
      if (!response.ok) {
        throw new Error(`Failed to fetch Shelltender sessions: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('[SessionCleanupService] Error fetching Shelltender sessions:', error);
      return [];
    }
  }

  /**
   * Terminate a Shelltender session
   */
  async terminateShelltenderSession(sessionId) {
    try {
      const response = await fetch(`${this.shelltenderUrl}/api/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        console.error(`[SessionCleanupService] Failed to terminate session ${sessionId}: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`[SessionCleanupService] Error terminating session ${sessionId}:`, error);
    }
  }

  /**
   * Clean up sessions for deleted tasks
   */
  async cleanupDeletedTaskSessions() {
    try {
      // Get all active sessions
      const sessions = await this.models.sessions.findAll({ isActive: true });
      
      // Group by task ID
      const taskIds = [...new Set(sessions.map(s => s.task_id))];
      
      // Check which tasks still exist
      for (const taskId of taskIds) {
        const task = await this.models.tasks.findById(taskId);
        if (!task) {
          console.log(`[SessionCleanupService] Task ${taskId} not found, cleaning up sessions`);
          
          // Get all sessions for this deleted task
          const taskSessions = sessions.filter(s => s.task_id === taskId);
          
          // Terminate and delete each session
          for (const session of taskSessions) {
            if (session.shelltender_session_id) {
              await this.terminateShelltenderSession(session.shelltender_session_id);
            }
            await this.models.sessions.delete(session.id);
          }
        }
      }
    } catch (error) {
      console.error('[SessionCleanupService] Error cleaning up deleted task sessions:', error);
    }
  }
}