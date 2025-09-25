/**
 * MonitoringService - Handles system monitoring, health checks, and AI session tracking
 * 
 * This service provides a clean interface for monitoring operations,
 * hiding the complexity of AI monitoring, notification management,
 * session analytics, and health status tracking.
 * 
 * Following deep module principles: simple interface (4-5 methods),
 * complex implementation handling multiple monitoring concerns.
 */
export class MonitoringService {
  constructor(models, eventEmitterService = null) {
    this.models = models;
    this.eventEmitterService = eventEmitterService;
    
    // Will be injected by server.js
    this.aiMonitor = null;
    this.notificationService = null;
  }

  /**
   * Set monitoring dependencies (called by server.js during initialization)
   * @param {Object} aiMonitor - AI monitoring service instance
   * @param {Object} notificationService - Notification service instance
   */
  setMonitoringDependencies(aiMonitor, notificationService) {
    this.aiMonitor = aiMonitor;
    this.notificationService = notificationService;
  }

  /**
   * Get comprehensive monitoring status including AI and system health
   * @returns {Promise<Object>} Complete monitoring status
   */
  async getSystemMonitoringStatus() {
    try {
      // Get AI monitoring status
      const aiStatus = this._getAIMonitoringStatus();
      
      // Get notification status
      const notificationStatus = this._getNotificationStatus();
      
      // Get basic system health
      const systemHealth = await this._getSystemHealth();
      
      // Emit monitoring metrics collected event
      if (this.eventEmitterService) {
        this.eventEmitterService.emit('monitoring.metrics-collected', {
          aiStatus,
          notificationStatus,
          systemHealth
        });
      }
      
      return {
        enabled: aiStatus.enabled,
        aiMonitoring: aiStatus,
        notifications: notificationStatus,
        system: systemHealth,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Emit critical health event on monitoring failure
      if (this.eventEmitterService) {
        this.eventEmitterService.emit('monitoring.health-critical', {
          error: error.message,
          component: 'monitoring-service'
        });
      }
      throw error;
    }
  }

  /**
   * Get notifications with pagination and filtering
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Notifications data
   */
  async getNotifications(options = {}) {
    const { limit = 50, offset = 0 } = options;
    
    if (!this.notificationService) {
      return { 
        notifications: [],
        total: 0,
        message: 'Notification service not available' 
      };
    }
    
    try {
      // Use getRecentNotifications which exists in NotificationService
      const allNotifications = this.notificationService.getRecentNotifications(1000); // Get large set first
      
      // Apply offset and limit manually since the service doesn't support it
      const startIndex = parseInt(offset) || 0;
      const endIndex = startIndex + (parseInt(limit) || 50);
      const notifications = allNotifications.slice(startIndex, endIndex);
      
      return { 
        notifications,
        total: allNotifications.length,
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0
      };
    } catch (error) {
      console.error('Failed to get notifications:', error);
      return {
        notifications: [],
        total: 0,
        error: error.message
      };
    }
  }

  /**
   * Get detailed session state and analytics for a specific session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session state and analytics
   */
  async getSessionStateAndAnalytics(sessionId) {
    if (!this.aiMonitor) {
      throw new Error('AI monitoring not available');
    }
    
    try {
      // Get live state from AI monitor
      const liveState = this._getSessionLiveState(sessionId);
      
      // Get analytics from database
      const analytics = await this._getSessionAnalytics(sessionId);
      
      return {
        sessionId,
        ...liveState,
        analytics,
        lastUpdate: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Failed to get session state for ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Perform administrative actions (clear notifications, reset monitors, etc.)
   * @param {string} action - Action to perform
   * @param {Object} options - Action options
   * @returns {Promise<Object>} Action result
   */
  async performAdminAction(action, options = {}) {
    switch (action) {
      case 'clear-notifications':
        return this._clearNotifications();
      
      case 'reset-ai-monitor':
        return this._resetAIMonitor();
      
      case 'get-task-sessions':
        return this._getTaskSessions(options.taskId);
      
      default:
        throw new Error(`Unknown admin action: ${action}`);
    }
  }

  // Private implementation methods - hiding complexity

  /**
   * Get AI monitoring status
   * @private
   */
  _getAIMonitoringStatus() {
    if (!this.aiMonitor) {
      return {
        enabled: false,
        message: 'AI monitoring not initialized (Shelltender may not be running)',
        sessionsMonitored: 0,
        recentPatterns: 0
      };
    }
    
    return {
      enabled: true,
      sessionsMonitored: this.aiMonitor.getMonitoredSessions ? 
        this.aiMonitor.getMonitoredSessions().size : 0,
      recentPatterns: this.aiMonitor.recentPatterns ? 
        this.aiMonitor.recentPatterns.size : 0
    };
  }

  /**
   * Get notification service status
   * @private
   */
  _getNotificationStatus() {
    if (!this.notificationService) {
      return {
        available: false,
        count: 0,
        message: 'Notification service not available'
      };
    }
    
    try {
      // Use getStats method which exists in NotificationService
      const stats = this.notificationService.getStats();
      
      return {
        available: true,
        count: stats.total,
        unread: stats.unread,
        lastHour: stats.lastHour
      };
    } catch (error) {
      return {
        available: true,
        count: 0,
        error: error.message
      };
    }
  }

  /**
   * Get basic system health metrics
   * @private
   */
  async _getSystemHealth() {
    const startTime = process.hrtime();
    
    // Check database connectivity
    let dbHealthy = true;
    try {
      await this.models.projects.findActive();
    } catch (error) {
      dbHealthy = false;
    }
    
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const responseTime = (seconds * 1000 + nanoseconds / 1000000).toFixed(2);
    
    const health = {
      database: dbHealthy ? 'healthy' : 'unhealthy',
      responseTime: `${responseTime}ms`,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version
    };
    
    // Emit critical health event if database is unhealthy
    if (!dbHealthy && this.eventEmitterService) {
      this.eventEmitterService.emit('monitoring.health-critical', {
        component: 'database',
        issue: 'Database connectivity failed'
      });
    }
    
    return health;
  }

  /**
   * Get live session state from AI monitor
   * @private
   */
  _getSessionLiveState(sessionId) {
    const state = this.aiMonitor.getSessionState ? 
      this.aiMonitor.getSessionState(sessionId) : 
      'unknown';
    
    const patterns = this.aiMonitor.getSessionPatterns ?
      this.aiMonitor.getSessionPatterns(sessionId) :
      [];
    
    return {
      state,
      patterns,
      lastUpdate: this.aiMonitor.getLastUpdate ? 
        this.aiMonitor.getLastUpdate(sessionId) : 
        null
    };
  }

  /**
   * Get session analytics from database
   * @private
   */
  async _getSessionAnalytics(sessionId) {
    try {
      // Get session from database
      const session = await this.models.sessions.findById(sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }
      
      // Compute basic analytics from session data
      const analytics = {
        message_count: session.message_count || 0,
        token_usage: session.token_usage || {},
        error_count: session.error_count || 0,
        duration: session.created_at && session.last_activity ? 
          new Date(session.last_activity) - new Date(session.created_at) : 0
      };
      
      return {
        session,
        analytics
      };
    } catch (error) {
      console.error(`Failed to get analytics for session ${sessionId}:`, error);
      return {
        session: null,
        analytics: null,
        error: error.message
      };
    }
  }

  /**
   * Clear all notifications
   * @private
   */
  async _clearNotifications() {
    if (!this.notificationService) {
      throw new Error('Notification service not available');
    }
    
    try {
      // NotificationService doesn't have clearNotifications, but has clearOldNotifications
      // We'll clear all notifications by setting maxAge to 0 (clear everything)
      const clearedCount = this.notificationService.clearOldNotifications(0);
      
      return { 
        success: true,
        message: 'Notifications cleared',
        count: clearedCount 
      };
    } catch (error) {
      throw new Error(`Failed to clear notifications: ${error.message}`);
    }
  }

  /**
   * Reset AI monitor (if needed for troubleshooting)
   * @private
   */
  async _resetAIMonitor() {
    if (!this.aiMonitor) {
      throw new Error('AI monitor not available');
    }
    
    // This would depend on aiMonitor having a reset method
    // For now, just return status
    return {
      success: true,
      message: 'AI monitor status checked',
      status: this._getAIMonitoringStatus()
    };
  }

  /**
   * Get all sessions for a task
   * @private
   */
  async _getTaskSessions(taskId) {
    if (!taskId) {
      throw new Error('Task ID is required');
    }
    
    try {
      const sessions = await this.models.sessions.findByTaskId(taskId);
      
      return { 
        taskId,
        sessions,
        count: sessions.length
      };
    } catch (error) {
      throw new Error(`Failed to get sessions for task ${taskId}: ${error.message}`);
    }
  }
}