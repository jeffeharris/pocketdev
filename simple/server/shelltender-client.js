/**
 * Shelltender Client
 * HTTP client for communicating with the standalone Shelltender service
 */

import fetch from 'node-fetch';
import config from './config/index.js';

class ShelltenderClient {
  constructor(apiUrl = config.shelltenderApiUrl) {
    this.apiUrl = apiUrl;
  }

  // Create a new task session
  async createTaskSession(taskId, worktreePath, metadata = {}) {
    try {
      const sessionId = `task-${taskId}`;
      
      const response = await fetch(`${this.apiUrl}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sessionId,
          name: `Task ${taskId}`,
          command: 'bash',
          cwd: worktreePath,
          env: {
            TASK_ID: taskId,
            WORKTREE_PATH: worktreePath
          },
          metadata: {
            taskId,
            worktreePath,
            createdAt: new Date().toISOString(),
            ...metadata
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        id: data.id,
        status: data.created ? 'created' : 'existing',
        metadata: { ...metadata, taskId, worktreePath }
      };
      
    } catch (error) {
      console.error(`Failed to create session for task ${taskId}:`, error);
      throw error;
    }
  }

  // Execute command in session
  async executeCommand(sessionId, command) {
    try {
      const response = await fetch(`${this.apiUrl}/sessions/${sessionId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });

      if (!response.ok) {
        throw new Error(`Failed to execute command: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to execute command in session ${sessionId}:`, error);
      throw error;
    }
  }

  // Get session info
  async getSessionInfo(sessionId) {
    try {
      const response = await fetch(`${this.apiUrl}/sessions/${sessionId}`);
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to get session info: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to get session ${sessionId} info:`, error);
      throw error;
    }
  }

  // List all sessions
  async listSessions() {
    try {
      const response = await fetch(`${this.apiUrl}/sessions`);
      
      if (!response.ok) {
        throw new Error(`Failed to list sessions: ${response.statusText}`);
      }

      const sessions = await response.json();
      
      // Format to match existing API
      return sessions.map(session => ({
        id: session.id,
        name: session.name,
        status: session.status,
        metadata: session.metadata,
        createdAt: session.createdAt,
        lastActivity: session.lastAccessedAt
      }));
    } catch (error) {
      console.error('Failed to list sessions:', error);
      throw error;
    }
  }

  // Close session
  async closeSession(sessionId) {
    try {
      const response = await fetch(`${this.apiUrl}/sessions/${sessionId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Failed to close session: ${response.statusText}`);
      }

      console.log(`Closed session ${sessionId}`);
    } catch (error) {
      console.error(`Failed to close session ${sessionId}:`, error);
      throw error;
    }
  }

  // Clean up old sessions
  async cleanupSessions(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
    try {
      const sessions = await this.listSessions();
      const now = Date.now();
      let cleaned = 0;
      
      for (const session of sessions) {
        const age = now - new Date(session.lastActivity).getTime();
        if (age > maxAge) {
          await this.closeSession(session.id);
          cleaned++;
        }
      }
      
      console.log(`Cleaned up ${cleaned} old sessions`);
      return cleaned;
    } catch (error) {
      console.error('Failed to cleanup sessions:', error);
      throw error;
    }
  }

  // Health check
  async health() {
    try {
      const response = await fetch(`${this.apiUrl}/health`);
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }
}

// Create singleton instance
const shelltenderApiUrl = process.env.SHELLTENDER_API_URL || 'http://localhost:8081';
const shelltenderClient = new ShelltenderClient(shelltenderApiUrl);

// Export the same interface as before to minimize changes
export async function createTaskSession(taskId, worktreePath, metadata = {}) {
  return shelltenderClient.createTaskSession(taskId, worktreePath, metadata);
}

export async function executeCommand(sessionId, command) {
  return shelltenderClient.executeCommand(sessionId, command);
}

export async function getSessionInfo(sessionId) {
  return shelltenderClient.getSessionInfo(sessionId);
}

export async function listSessions() {
  return shelltenderClient.listSessions();
}

export async function closeSession(sessionId) {
  return shelltenderClient.closeSession(sessionId);
}

export async function cleanupSessions(maxAge) {
  return shelltenderClient.cleanupSessions(maxAge);
}

// Export client for direct use if needed
export { shelltenderClient };