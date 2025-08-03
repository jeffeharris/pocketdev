/**
 * Get AI monitoring status
 */
export async function getMonitoringStatus(req, res, next) {
  try {
    const status = await req.services.MonitoringService.getSystemMonitoringStatus();
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
    const { limit = 50, offset = 0 } = req.query;
    const result = await req.services.MonitoringService.getNotifications({ limit, offset });
    res.json(result);
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
    const result = await req.services.MonitoringService.getSessionStateAndAnalytics(sessionId);
    res.json(result);
  } catch (error) {
    if (error.message === 'AI monitoring not available') {
      return res.status(503).json({ error: error.message });
    }
    next(error);
  }
}

/**
 * Clear notifications
 */
export async function clearNotifications(req, res, next) {
  try {
    const result = await req.services.MonitoringService.performAdminAction('clear-notifications');
    res.json(result);
  } catch (error) {
    if (error.message.includes('not available')) {
      return res.status(503).json({ error: error.message });
    }
    next(error);
  }
}

/**
 * Get Claude session analytics
 */
export async function getSessionAnalytics(req, res, next) {
  try {
    const { sessionId } = req.params;
    const result = await req.services.MonitoringService.getSessionStateAndAnalytics(sessionId);
    
    if (!result.analytics || !result.analytics.session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(result.analytics);
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
    const result = await req.services.MonitoringService.performAdminAction('get-task-sessions', { taskId });
    res.json(result);
  } catch (error) {
    next(error);
  }
}