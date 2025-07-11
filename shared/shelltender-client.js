import fetch from 'node-fetch';
import config from './config/index.js';

const SHELLTENDER_API_URL = config.shelltenderApiUrl || `http://localhost:${config.shelltenderPort || 8080}`;

/**
 * List all sessions
 */
export async function listSessions() {
  try {
    const response = await fetch(`${SHELLTENDER_API_URL}/sessions`);
    if (!response.ok) {
      throw new Error(`Failed to list sessions: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error listing sessions:', error);
    throw error;
  }
}

/**
 * Get session info
 */
export async function getSessionInfo(sessionId) {
  try {
    const response = await fetch(`${SHELLTENDER_API_URL}/sessions/${sessionId}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to get session info: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error getting session info:', error);
    throw error;
  }
}

/**
 * Create a task session
 */
export async function createTaskSession(sessionId, taskTitle) {
  try {
    const response = await fetch(`${SHELLTENDER_API_URL}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: sessionId,
        metadata: {
          title: taskTitle,
          type: 'task'
        }
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating task session:', error);
    throw error;
  }
}

/**
 * Execute a command in a session
 */
export async function executeCommand(sessionId, command) {
  try {
    const response = await fetch(`${SHELLTENDER_API_URL}/sessions/${sessionId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to execute command: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error executing command:', error);
    throw error;
  }
}