import { createTaskSession, executeCommand, getSessionInfo, listSessions } from '../shelltender-client.js';

/**
 * Get all terminal sessions
 */
export async function getAllSessions(req, res, next) {
  try {
    const sessions = await listSessions();
    res.json(sessions || []);
  } catch (error) {
    next(error);
  }
}

/**
 * Get sessions needing AI attention
 */
export async function getAttentionSessions(req, res, next) {
  try {
    const aiMonitor = req.app.locals.aiMonitor;
    
    if (!aiMonitor || !aiMonitor.getSessionsNeedingAttention) {
      return res.json({ sessions: [] });
    }
    
    const sessions = aiMonitor.getSessionsNeedingAttention();
    res.json({ sessions: Array.from(sessions) });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all AI session states
 */
export async function getAIStates(req, res, next) {
  try {
    const aiMonitor = req.app.locals.aiMonitor;
    
    if (!aiMonitor || !aiMonitor.getAllSessionStatuses) {
      return res.json([]);
    }
    
    const states = aiMonitor.getAllSessionStatuses();
    res.json(states);
  } catch (error) {
    next(error);
  }
}

/**
 * Get specific session info
 */
export async function getSession(req, res, next) {
  try {
    const { sessionId } = req.params;
    const sessionInfo = await getSessionInfo(sessionId);
    
    if (!sessionInfo) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(sessionInfo);
  } catch (error) {
    next(error);
  }
}

/**
 * Create terminal session for task
 */
export async function createTerminalSession(req, res, next) {
  try {
    const { projectId, taskId } = req.params;
    const models = req.app.locals.models;
    
    // Verify task exists
    const task = await models.tasks.findById(taskId);
    if (!task || task.project_id !== projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Create or get existing session
    const result = await createTaskSession(taskId, task.worktree_path);
    
    res.json({
      sessionId: result.id,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Execute command in terminal session
 */
export async function executeInSession(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    
    const result = await executeCommand(sessionId, command);
    res.json({
      sessionId,
      command,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Acknowledge AI session
 */
export async function acknowledgeSession(req, res, next) {
  try {
    const { sessionId } = req.params;
    const aiMonitor = req.app.locals.aiMonitor;
    
    if (!aiMonitor || !aiMonitor.acknowledgeSession) {
      return res.status(503).json({ error: 'AI monitoring not available' });
    }
    
    aiMonitor.acknowledgeSession(sessionId);
    res.json({ 
      message: 'Session acknowledged',
      sessionId 
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Respond to AI prompt
 */
export async function respondToPrompt(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { response } = req.body;
    
    if (!response) {
      return res.status(400).json({ error: 'Response is required' });
    }
    
    // Execute the response as a command
    const result = await executeCommand(sessionId, response);
    
    res.json({
      sessionId,
      response,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Shelltender session ID for task
 */
export async function getShelltenderSession(req, res, next) {
  try {
    const { taskId } = req.params;
    const sessionId = `task-${taskId}`;
    
    const sessionInfo = await getSessionInfo(sessionId);
    
    res.json({
      sessionId,
      exists: !!sessionInfo,
      info: sessionInfo,
      metadata: sessionInfo?.metadata || {}
    });
  } catch (error) {
    next(error);
  }
}