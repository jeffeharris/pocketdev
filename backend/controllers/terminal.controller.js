import { listSessions, getSessionInfo } from '../../shared/shelltender-client.js';

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
 * Helper function to check if a Shelltender session exists and is active
 */
async function checkShelltenderSession(sessionId) {
  try {
    const shelltenderUrl = process.env.SHELLTENDER_API_URL || 'http://shelltender:8080';
    const response = await fetch(`${shelltenderUrl}/api/sessions/${sessionId}`);
    if (response.ok) {
      const session = await response.json();
      return session.status === 'active' ? session : null;
    }
    return null;
  } catch (error) {
    console.error('Error checking Shelltender session:', error);
    return null;
  }
}

/**
 * Create terminal session for task
 */
export async function createTerminalSession(req, res, next) {
  try {
    const { projectId, taskId } = req.params;
    const { tabName, aiAgent, initialPrompt, workingDirectory, copyHistoryFrom } = req.body;
    
    // Verify task exists and belongs to project
    const task = await req.app.locals.models.tasks.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    if (projectId && task.project_id !== projectId) {
      return res.status(404).json({ error: 'Task not found in project' });
    }
    
    // Get TerminalService from service registry
    const terminalService = req.services.get('TerminalService');
    
    // Create terminal session using service
    const sessionInfo = await terminalService.createSession(
      taskId,
      { tabName, aiAgent, initialPrompt, workingDirectory },
      {
        wsAdapter: req.app.locals.wsAdapter,
        aiMonitor: req.app.locals.aiMonitor
      }
    );
    
    res.json(sessionInfo);
  } catch (error) {
    if (error.message.includes('Maximum number of terminals')) {
      return res.status(400).json({ error: error.message });
    }
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
    
    if (command === undefined) {
      return res.status(400).json({ error: 'Command is required' });
    }
    
    // Get TerminalService from service registry
    const terminalService = req.services.get('TerminalService');
    
    // Execute command using service
    const result = await terminalService.executeCommand(
      sessionId,
      command,
      req.app.locals.wsAdapter
    );
    
    res.json(result);
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
    
    // Get TerminalService from service registry
    const terminalService = req.services.get('TerminalService');
    
    // Acknowledge session using service
    const result = await terminalService.acknowledgeSession(
      sessionId,
      req.app.locals.aiMonitor
    );
    
    res.json(result);
  } catch (error) {
    if (error.message === 'AI monitoring not available') {
      return res.status(503).json({ error: error.message });
    }
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
    
    // Get TerminalService from service registry
    const terminalService = req.services.get('TerminalService');
    
    // Execute the response as a command
    const result = await terminalService.executeCommand(
      sessionId,
      response,
      req.app.locals.wsAdapter
    );
    
    res.json(result);
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

/**
 * Reset terminal session to original state
 */
export async function resetSession(req, res, next) {
  try {
    const { sessionId } = req.params;
    
    // Get TerminalService from service registry
    const terminalService = req.services.get('TerminalService');
    
    // Reset session using service
    const result = await terminalService.resetSession(sessionId);
    
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Update terminal tab properties
 */
export async function updateTerminalTab(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { tabName, tabOrder } = req.body;
    
    // Get TerminalService from service registry
    const terminalService = req.services.get('TerminalService');
    
    // Update tab using service
    const updatedSession = await terminalService.updateSessionTab(sessionId, {
      tabName,
      tabOrder
    });
    
    res.json(updatedSession);
  } catch (error) {
    if (error.message === 'Session not found') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
}

/**
 * Delete a terminal session
 */
export async function deleteTerminalSession(req, res, next) {
  try {
    const { sessionId } = req.params;
    console.log('[TerminalController] DELETE /terminals/:sessionId called with:', sessionId);
    
    // Get TerminalService from service registry
    const terminalService = req.services.get('TerminalService');
    
    // Delete session using service
    const result = await terminalService.deleteSession(sessionId);
    console.log('[TerminalController] Delete successful:', result);
    
    res.json(result);
  } catch (error) {
    console.log('[TerminalController] Delete failed:', error.message);
    if (error.message === 'Session not found') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
}

/**
 * Get AI agent configurations
 */
export async function getAIAgents(req, res, next) {
  try {
    // Get TerminalService from service registry
    const terminalService = req.services.get('TerminalService');
    
    // Get available agents using service
    const agents = terminalService.getAvailableAgents();
    
    res.json(agents);
  } catch (error) {
    next(error);
  }
}

/**
 * Get launch command for a specific AI agent
 */
export async function getAgentLaunchCommandHandler(req, res, next) {
  try {
    const { agentId } = req.params;
    const { prompt } = req.body;
    
    // Get TerminalService from service registry
    const terminalService = req.services.get('TerminalService');
    
    // Get agent launch command using service
    const result = terminalService.getAgentLaunchCommand(agentId, prompt);
    
    res.json(result);
  } catch (error) {
    if (error.message === 'Agent not found') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
}