const crypto = require('crypto');

class SessionModel {
  constructor(db) {
    this.db = db;
  }

  generateId() {
    return crypto.randomBytes(4).toString('hex');
  }

  async create(taskId, data) {
    const id = data.id || this.generateId();
    const now = new Date().toISOString();
    
    const result = await this.db.run(`
      INSERT INTO claude_sessions (
        id, task_id, session_id, is_active, message_count, 
        created_at, last_activity, size_bytes, token_usage, 
        tool_usage, model, error_count, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, 
      taskId, 
      data.sessionId || data.session_id,
      data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1,
      data.messageCount || data.message_count || 0,
      data.createdAt || data.created_at || now,
      data.lastActivity || data.last_activity || now,
      data.sizeBytes || data.size_bytes || 0,
      JSON.stringify(data.tokenUsage || data.token_usage || {}),
      JSON.stringify(data.toolUsage || data.tool_usage || {}),
      data.model || null,
      data.errorCount || data.error_count || 0,
      JSON.stringify(data.metadata || {})
    ]);

    return this.findById(id);
  }

  async findById(id) {
    const session = await this.db.get(`
      SELECT cs.*,
        t.name as task_name,
        t.branch as task_branch,
        p.id as project_id,
        p.name as project_name
      FROM claude_sessions cs
      JOIN tasks t ON cs.task_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE cs.id = ?
    `, [id]);

    if (session) {
      // Parse JSON fields
      try {
        session.token_usage = JSON.parse(session.token_usage || '{}');
        session.tool_usage = JSON.parse(session.tool_usage || '{}');
        session.metadata = JSON.parse(session.metadata || '{}');
      } catch (e) {
        session.token_usage = {};
        session.tool_usage = {};
        session.metadata = {};
      }
    }

    return session;
  }

  async findByTaskId(taskId) {
    const sessions = await this.db.all(`
      SELECT * FROM claude_sessions
      WHERE task_id = ?
      ORDER BY last_activity DESC
    `, [taskId]);

    // Parse JSON fields
    for (const session of sessions) {
      try {
        session.token_usage = JSON.parse(session.token_usage || '{}');
        session.tool_usage = JSON.parse(session.tool_usage || '{}');
        session.metadata = JSON.parse(session.metadata || '{}');
      } catch (e) {
        session.token_usage = {};
        session.tool_usage = {};
        session.metadata = {};
      }
    }

    return sessions;
  }

  async findActiveByTaskId(taskId) {
    const sessions = await this.db.all(`
      SELECT * FROM claude_sessions
      WHERE task_id = ? AND is_active = 1
      ORDER BY last_activity DESC
    `, [taskId]);

    // Parse JSON fields
    for (const session of sessions) {
      try {
        session.token_usage = JSON.parse(session.token_usage || '{}');
        session.tool_usage = JSON.parse(session.tool_usage || '{}');
        session.metadata = JSON.parse(session.metadata || '{}');
      } catch (e) {
        session.token_usage = {};
        session.tool_usage = {};
        session.metadata = {};
      }
    }

    return sessions;
  }

  async update(id, data) {
    const fields = [];
    const values = [];

    if (data.isActive !== undefined || data.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push((data.isActive || data.is_active) ? 1 : 0);
    }
    if (data.messageCount !== undefined || data.message_count !== undefined) {
      fields.push('message_count = ?');
      values.push(data.messageCount || data.message_count);
    }
    if (data.sizeBytes !== undefined || data.size_bytes !== undefined) {
      fields.push('size_bytes = ?');
      values.push(data.sizeBytes || data.size_bytes);
    }
    if (data.tokenUsage !== undefined || data.token_usage !== undefined) {
      fields.push('token_usage = ?');
      values.push(JSON.stringify(data.tokenUsage || data.token_usage));
    }
    if (data.toolUsage !== undefined || data.tool_usage !== undefined) {
      fields.push('tool_usage = ?');
      values.push(JSON.stringify(data.toolUsage || data.tool_usage));
    }
    if (data.model !== undefined) {
      fields.push('model = ?');
      values.push(data.model);
    }
    if (data.errorCount !== undefined || data.error_count !== undefined) {
      fields.push('error_count = ?');
      values.push(data.errorCount || data.error_count);
    }
    if (data.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(JSON.stringify(data.metadata));
    }

    // Always update last_activity
    fields.push('last_activity = CURRENT_TIMESTAMP');

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await this.db.run(`
      UPDATE claude_sessions 
      SET ${fields.join(', ')}
      WHERE id = ?
    `, values);

    return this.findById(id);
  }

  async deactivateAllForTask(taskId) {
    await this.db.run(`
      UPDATE claude_sessions 
      SET is_active = 0
      WHERE task_id = ?
    `, [taskId]);
  }

  async getTaskAnalytics(taskId) {
    const result = await this.db.get(`
      SELECT 
        COUNT(*) as total_sessions,
        SUM(message_count) as total_messages,
        SUM(size_bytes) as total_size,
        SUM(error_count) as total_errors,
        MAX(last_activity) as last_activity
      FROM claude_sessions
      WHERE task_id = ?
    `, [taskId]);

    // Get aggregated token usage
    const sessions = await this.db.all(`
      SELECT token_usage, tool_usage
      FROM claude_sessions
      WHERE task_id = ?
    `, [taskId]);

    const aggregated = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheRead: 0,
      totalCacheCreated: 0,
      toolUsage: {}
    };

    for (const session of sessions) {
      try {
        const tokens = JSON.parse(session.token_usage || '{}');
        const tools = JSON.parse(session.tool_usage || '{}');
        
        aggregated.totalInputTokens += tokens.totalInputTokens || 0;
        aggregated.totalOutputTokens += tokens.totalOutputTokens || 0;
        aggregated.totalCacheRead += tokens.totalCacheRead || 0;
        aggregated.totalCacheCreated += tokens.totalCacheCreated || 0;
        
        // Aggregate tool usage
        for (const [tool, count] of Object.entries(tools)) {
          aggregated.toolUsage[tool] = (aggregated.toolUsage[tool] || 0) + count;
        }
      } catch (e) {
        // Skip invalid data
      }
    }

    return {
      ...result,
      ...aggregated
    };
  }

  async delete(id) {
    await this.db.run('DELETE FROM claude_sessions WHERE id = ?', [id]);
  }

  async deleteByTaskId(taskId) {
    await this.db.run('DELETE FROM claude_sessions WHERE task_id = ?', [taskId]);
  }
}

module.exports = SessionModel;