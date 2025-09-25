/**
 * SessionModel - Pure Single-Table Model
 * 
 * Only queries the terminal_sessions table. No joins to tasks or projects.
 * Cross-table operations moved to TerminalService.
 */
import BaseModel from './base-model.js';
import { v4 as uuidv4 } from 'uuid';

class SessionModel extends BaseModel {
  constructor(db) {
    super(db, 'terminal_sessions');
    this.jsonFields = ['token_usage', 'tool_usage', 'metadata'];
  }

  /**
   * Create a new terminal session
   * @param {Object} sessionData
   * @returns {Promise<Object>} The created session
   */
  async create(sessionData) {
    const session = {
      id: sessionData.id || uuidv4(),
      task_id: sessionData.task_id,
      session_id: sessionData.session_id,
      shelltender_session_id: sessionData.shelltender_session_id || null,
      tab_name: sessionData.tab_name || 'Main',
      tab_order: sessionData.tab_order || 0,
      ai_agent: sessionData.ai_agent || 'claude',
      ai_session_id: sessionData.ai_session_id || null,
      ai_state: sessionData.ai_state || 'not-started',
      ai_state_updated_at: sessionData.ai_state_updated_at || null,
      is_active: sessionData.is_active !== undefined ? sessionData.is_active : 1,
      message_count: sessionData.message_count || 0,
      size_bytes: sessionData.size_bytes || 0,
      token_usage: sessionData.token_usage || {},
      tool_usage: sessionData.tool_usage || {},
      model: sessionData.model || null,
      error_count: sessionData.error_count || 0,
      metadata: sessionData.metadata || {},
      created_at: new Date().toISOString(),
      last_activity: new Date().toISOString()
    };

    return super.create(session);
  }

  /**
   * Find all sessions for a task
   * @param {string} taskId
   * @returns {Promise<Array>}
   */
  async findByTaskId(taskId) {
    return this.findAll({ task_id: taskId });
  }

  /**
   * Find active sessions for a task
   * @param {string} taskId
   * @returns {Promise<Array>}
   */
  async findActiveByTaskId(taskId) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE task_id = ? AND is_active = 1
      ORDER BY last_activity DESC
    `;
    
    const results = await this.db.all(query, [taskId]);
    return this.parseJsonFieldsMany(results);
  }


  /**
   * Find session by Shelltender session ID
   * @param {string} shelltenderSessionId
   * @returns {Promise<Object|null>}
   */
  async findByShelltenderId(shelltenderSessionId) {
    return this.findOne({ shelltender_session_id: shelltenderSessionId });
  }

  /**
   * Find session by session_id (not the primary key)
   * @param {string} sessionId
   * @returns {Promise<Object|null>}
   */
  async findBySessionId(sessionId) {
    return this.findOne({ session_id: sessionId });
  }

  /**
   * Update AI state
   * @param {string} id
   * @param {string} aiState
   * @returns {Promise<Object|null>}
   */
  async updateAiState(id, aiState) {
    return this.update(id, {
      ai_state: aiState,
      ai_state_updated_at: new Date().toISOString(),
      last_activity: new Date().toISOString()
    });
  }

  /**
   * Update session activity
   * @param {string} id
   * @param {Object} activityData
   * @returns {Promise<Object|null>}
   */
  async updateActivity(id, activityData) {
    const updates = {
      last_activity: new Date().toISOString()
    };

    if ('message_count' in activityData) {
      updates.message_count = activityData.message_count;
    }

    if ('size_bytes' in activityData) {
      updates.size_bytes = activityData.size_bytes;
    }

    if ('error_count' in activityData) {
      updates.error_count = activityData.error_count;
    }

    return this.update(id, updates);
  }

  /**
   * Update token usage
   * @param {string} id
   * @param {Object} tokenUsage
   * @returns {Promise<Object|null>}
   */
  async updateTokenUsage(id, tokenUsage) {
    const session = await this.findById(id);
    if (!session) return null;

    const updatedTokenUsage = {
      ...(session.token_usage || {}),
      ...tokenUsage
    };

    return this.update(id, {
      token_usage: updatedTokenUsage,
      last_activity: new Date().toISOString()
    });
  }

  /**
   * Update tool usage
   * @param {string} id
   * @param {Object} toolUsage
   * @returns {Promise<Object|null>}
   */
  async updateToolUsage(id, toolUsage) {
    const session = await this.findById(id);
    if (!session) return null;

    const updatedToolUsage = {
      ...(session.tool_usage || {}),
      ...toolUsage
    };

    return this.update(id, {
      tool_usage: updatedToolUsage,
      last_activity: new Date().toISOString()
    });
  }

  /**
   * Deactivate a session
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async deactivate(id) {
    return this.update(id, {
      is_active: 0,
      last_activity: new Date().toISOString()
    });
  }

  /**
   * Reactivate a session
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async reactivate(id) {
    return this.update(id, {
      is_active: 1,
      last_activity: new Date().toISOString()
    });
  }

  /**
   * Find sessions in a specific AI state
   * @param {string} aiState
   * @returns {Promise<Array>}
   */
  async findByAiState(aiState) {
    return this.findAll({ ai_state: aiState, is_active: 1 });
  }

  /**
   * Find stale sessions (not updated recently)
   * @param {number} hoursAgo
   * @returns {Promise<Array>}
   */
  async findStale(hoursAgo = 24) {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE is_active = 1 AND last_activity < ?
      ORDER BY last_activity ASC
    `;
    
    const results = await this.db.all(query, [cutoffTime]);
    return this.parseJsonFieldsMany(results);
  }

  /**
   * Get session statistics for a task
   * @param {string} taskId
   * @returns {Promise<Object>}
   */
  async getTaskStats(taskId) {
    const query = `
      SELECT 
        COUNT(*) as total_sessions,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_sessions,
        SUM(message_count) as total_messages,
        SUM(size_bytes) as total_bytes,
        SUM(error_count) as total_errors
      FROM ${this.tableName}
      WHERE task_id = ?
    `;
    
    return this.db.get(query, [taskId]);
  }

  /**
   * Delete sessions for a task
   * @param {string} taskId
   * @returns {Promise<number>} Number of deleted sessions
   */
  async deleteByTaskId(taskId) {
    const result = await this.db.run(
      `DELETE FROM ${this.tableName} WHERE task_id = ?`,
      [taskId]
    );
    return result.changes;
  }

  /**
   * Update metadata
   * @param {string} id
   * @param {Object} metadata
   * @returns {Promise<Object|null>}
   */
  async updateMetadata(id, metadata) {
    const session = await this.findById(id);
    if (!session) return null;

    const updatedMetadata = {
      ...(session.metadata || {}),
      ...metadata
    };

    return this.update(id, {
      metadata: updatedMetadata,
      last_activity: new Date().toISOString()
    });
  }
}

export default SessionModel;