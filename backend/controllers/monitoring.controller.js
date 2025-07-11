/**
 * Get AI monitoring status
 */
export async function getMonitoringStatus(req, res, next) {
  try {
    const aiMonitor = req.app.locals.aiMonitor;
    const notificationService = req.app.locals.notificationService;
    
    if (!aiMonitor) {
      return res.json({
        enabled: false,
        message: 'AI monitoring not initialized (Shelltender may not be running)'
      });
    }
    
    const status = {
      enabled: true,
      sessionsMonitored: aiMonitor.getMonitoredSessions ? aiMonitor.getMonitoredSessions().size : 0,
      recentPatterns: aiMonitor.recentPatterns ? aiMonitor.recentPatterns.size : 0,
      notificationCount: notificationService && notificationService.notifications ? notificationService.notifications.length : 0
    };
    
    res.json(status);
  } catch (error) {
    next(error);
  }
}

/**
 * Get notifications
 */
export async function getNotifications(req, res, next) {
  try {
    const notificationService = req.app.locals.notificationService;
    const { limit = 50, offset = 0 } = req.query;
    
    if (!notificationService) {
      return res.json({ 
        notifications: [],
        message: 'Notification service not available' 
      });
    }
    
    const notifications = notificationService.getNotifications(
      parseInt(limit),
      parseInt(offset)
    );
    
    res.json({ notifications });
  } catch (error) {
    next(error);
  }
}

/**
 * Get AI session state for a specific session
 */
export async function getSessionState(req, res, next) {
  try {
    const { sessionId } = req.params;
    const aiMonitor = req.app.locals.aiMonitor;
    
    if (!aiMonitor) {
      return res.status(503).json({ 
        error: 'AI monitoring not available' 
      });
    }
    
    // Get state from AI monitor
    const state = aiMonitor.getSessionState ? 
      aiMonitor.getSessionState(sessionId) : 
      'unknown';
    
    // Get recent patterns for this session
    const patterns = aiMonitor.getSessionPatterns ?
      aiMonitor.getSessionPatterns(sessionId) :
      [];
    
    res.json({
      sessionId,
      state,
      patterns,
      lastUpdate: aiMonitor.getLastUpdate ? 
        aiMonitor.getLastUpdate(sessionId) : 
        null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Clear notifications
 */
export async function clearNotifications(req, res, next) {
  try {
    const notificationService = req.app.locals.notificationService;
    
    if (!notificationService) {
      return res.status(503).json({ 
        error: 'Notification service not available' 
      });
    }
    
    notificationService.clearNotifications();
    
    res.json({ 
      message: 'Notifications cleared',
      count: 0 
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Claude session analytics
 */
export async function getSessionAnalytics(req, res, next) {
  try {
    const { sessionId } = req.params;
    const models = req.app.locals.models;
    
    // Get session from database
    const session = await models.sessions.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Get analytics
    const analytics = await models.sessions.getAnalytics(sessionId);
    
    res.json({
      session,
      analytics
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all Claude sessions for a task
 */
export async function getTaskSessions(req, res, next) {
  try {
    const { taskId } = req.params;
    const models = req.app.locals.models;
    
    const sessions = await models.sessions.findByTaskId(taskId);
    
    res.json({ sessions });
  } catch (error) {
    next(error);
  }
}