import { createTaskSession, getSessionInfo, listSessions } from '../../shared/shelltender-client.js';
import { executeCommandViaWebSocket, executeCommandViaMonitor } from '../utils/execute-command.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    const models = req.app.locals.models;
    
    // Verify task exists
    const task = await models.tasks.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // If projectId is provided, verify it matches
    if (projectId && task.project_id !== projectId) {
      return res.status(404).json({ error: 'Task not found in project' });
    }
    
    // Get git config from settings
    const gitUserName = await models.db.get(
      'SELECT value FROM settings WHERE key = ?',
      ['git_user_name']
    );
    
    const gitUserEmail = await models.db.get(
      'SELECT value FROM settings WHERE key = ?',
      ['git_user_email']
    );
    
    const gitConfig = {
      name: gitUserName?.value || 'Pocketdev User',
      email: gitUserEmail?.value || 'user@pocketdev.local'
    };
    
    // Generate a stable database ID upfront
    const dbSessionId = models.sessions.generateId();
    
    // Generate stable Shelltender session ID using the database ID
    const shelltenderSessionId = `task-${taskId}-${dbSessionId}`;
    
    // Create database record with the final session ID
    const dbSession = await models.sessions.create(taskId, {
      id: dbSessionId,
      sessionId: shelltenderSessionId,  // Use the final ID from the start
      shelltenderSessionId: shelltenderSessionId,
      tabName: tabName,
      aiAgent: aiAgent || 'claude',
      aiSessionId: null,
      metadata: {
        initialPrompt: initialPrompt,
        workingDirectory: workingDirectory
      }
    });
    
    // Check if Shelltender session already exists
    const existingSession = await checkShelltenderSession(shelltenderSessionId);
    
    if (existingSession) {
      // Reconnect to existing session
      console.log(`[createTerminalSession] Reconnecting to existing session: ${shelltenderSessionId}`);
      
      // Session already exists and is properly configured in DB
      
      return res.json({
        sessionId: shelltenderSessionId,
        dbSessionId: dbSession.id,
        shelltenderSessionId: shelltenderSessionId,
        tabName: dbSession.tab_name,
        tabOrder: dbSession.tab_order,
        aiAgent: dbSession.ai_agent,
        isReconnected: true
      });
    }
    
    // Set working directory (default to task root)
    const workDir = workingDirectory 
      ? path.join(task.worktree_path, workingDirectory)
      : task.worktree_path;
    
    // Create new Shelltender session with stable ID
    console.log(`[createTerminalSession] Creating new session: ${shelltenderSessionId}`);
    const shelltenderUrl = process.env.SHELLTENDER_API_URL || 'http://shelltender:8080';
    const createResponse = await fetch(`${shelltenderUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: shelltenderSessionId,  // Use our stable ID
        command: '/bin/bash',
        args: ['--login', '-i'],  // Login + interactive to ensure all configs are loaded
        cwd: workDir,
        env: {
          TASK_ID: taskId,
          DB_SESSION_ID: dbSession.id,
          WORKTREE_PATH: task.worktree_path,
          TERM: 'xterm-256color',
          // Set PS1 to ensure we have a visible prompt
          PS1: '\\[\\033[01;32m\\]\\u@pocketdev\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ ',
          // Task-scoped history file
          HISTFILE: path.join(task.worktree_path, '.pocketdev_task_history'),
          HISTSIZE: '10000',
          HISTFILESIZE: '20000',
          // Git config for bashrc to use
          GIT_USER_NAME: gitConfig.name,
          GIT_USER_EMAIL: gitConfig.email
        },
        metadata: {
          taskId,
          dbSessionId: dbSession.id,
          title: task.name,
          type: 'task',
          tabName: tabName || 'Main',
          aiAgent: aiAgent || 'claude'
        }
      })
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Shelltender error:', errorText);
      throw new Error(`Failed to create session: ${createResponse.statusText} - ${errorText}`);
    }
    
    const result = await createResponse.json();
    
    // No need to update - we already set the correct IDs when creating
    
    // Note: Terminal initialization is now handled by the bashrc file
    // The executeCommand function doesn't work with Shelltender v0.6.1
    // Commands must be sent via WebSocket, which happens on the frontend
    
    res.json({
      sessionId: shelltenderSessionId,
      dbSessionId: dbSession.id,
      shelltenderSessionId: shelltenderSessionId,
      tabName: dbSession.tab_name,
      tabOrder: dbSession.tab_order,
      aiAgent: dbSession.ai_agent,
      isReconnected: false
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
    
    if (command === undefined) {
      return res.status(400).json({ error: 'Command is required' });
    }
    
    // Try to use the session monitor if available
    const monitor = req.app.locals.shelltenderMonitor;
    let result;
    
    if (monitor) {
      console.log('[executeInSession] Using session monitor');
      result = await executeCommandViaMonitor(sessionId, command, monitor);
    } else {
      console.log('[executeInSession] Using direct WebSocket connection');
      result = await executeCommandViaWebSocket(sessionId, command);
    }
    
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

/**
 * Reset terminal session to original state
 * For now: cd to task directory and clear screen
 * Future: could restore environment, clear command history, etc.
 */
export async function resetSession(req, res, next) {
  try {
    const { sessionId } = req.params;
    
    // Extract the task ID from session ID (format: task-{taskId})
    const taskId = sessionId.replace('task-', '');
    const models = req.app.locals.models;
    
    // Get task to find worktree path and session parameters
    const task = await models.tasks.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const shelltenderUrl = process.env.SHELLTENDER_API_URL || 'http://shelltender:8081';
    const authKey = process.env.SHELLTENDER_MONITOR_AUTH_KEY || 'pocketdev-monitor-key-2024';
    
    // Step 1: Kill the existing session
    try {
      await fetch(`${shelltenderUrl}/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'X-Auth-Key': authKey
        }
      });
    } catch (error) {
      // Session might already be gone, continue anyway
      console.log('Could not delete session, continuing...', error.message);
    }
    
    // Small delay to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 2: Create a new session with the same parameters
    const createResponse = await fetch(`${shelltenderUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Key': authKey
      },
      body: JSON.stringify({
        id: sessionId,
        name: `Task ${taskId}`,
        cwd: task.worktree_path,
        // Re-apply directory restrictions
        restrictToPath: task.worktree_path,
        allowUpwardNavigation: false,
        blockedCommands: ['sudo', 'su', 'chmod', 'chown'],
        readOnlyMode: false,
        env: {
          TASK_ID: taskId,
          WORKTREE_PATH: task.worktree_path
        },
        metadata: {
          taskId,
          worktreePath: task.worktree_path
        }
      })
    });
    
    if (!createResponse.ok) {
      throw new Error('Failed to create new session');
    }
    
    const newSession = await createResponse.json();
    
    res.json({
      sessionId,
      message: 'Session reset successfully',
      workingDirectory: task.worktree_path,
      newSession
    });
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
    const models = req.app.locals.models;
    
    // Update tab in database
    const updatedSession = await models.sessions.updateTab(sessionId, {
      tabName,
      tabOrder
    });
    
    if (!updatedSession) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(updatedSession);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a terminal session
 */
export async function deleteTerminalSession(req, res, next) {
  try {
    const { sessionId } = req.params;
    const models = req.app.locals.models;
    
    // Get session details to find Shelltender session ID
    const session = await models.sessions.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Terminate Shelltender session if it exists
    if (session.shelltender_session_id) {
      try {
        const shelltenderUrl = process.env.SHELLTENDER_API_URL || 'http://shelltender:8080';
        const response = await fetch(`${shelltenderUrl}/api/sessions/${session.shelltender_session_id}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          console.error(`Failed to terminate Shelltender session ${session.shelltender_session_id}:`, response.statusText);
        }
      } catch (error) {
        console.error(`Error terminating Shelltender session ${session.shelltender_session_id}:`, error);
        // Continue with database deletion even if Shelltender deletion fails
      }
    }
    
    // Delete from database
    await models.sessions.delete(sessionId);
    
    res.json({ success: true, message: 'Terminal session deleted' });
  } catch (error) {
    next(error);
  }
}