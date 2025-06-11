import crypto from 'crypto';

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
      session = this._parseSession(session);
    }

    return session;
  }

  async findByTaskId(taskId) {
    const sessions = await this.db.all(`
      SELECT * FROM claude_sessions 
      WHERE task_id = ?
      ORDER BY last_activity DESC
    `, [taskId]);

    return sessions.map(s => this._parseSession(s));
  }

  async findBySessionId(sessionId) {
    const session = await this.db.get(`
      SELECT * FROM claude_sessions 
      WHERE session_id = ?
    `, [sessionId]);

    if (session) {
      session = this._parseSession(session);
    }

    return session;
  }

  async update(id, data) {
    const updates = [];
    const values = [];
    
    if (data.is_active !== undefined || data.isActive !== undefined) {
      updates.push('is_active = ?');
      values.push((data.is_active || data.isActive) ? 1 : 0);
    }
    if (data.message_count !== undefined || data.messageCount !== undefined) {
      updates.push('message_count = ?');
      values.push(data.message_count || data.messageCount);
    }
    if (data.last_activity !== undefined || data.lastActivity !== undefined) {
      updates.push('last_activity = ?');
      values.push(data.last_activity || data.lastActivity);
    }
    if (data.size_bytes !== undefined || data.sizeBytes !== undefined) {
      updates.push('size_bytes = ?');
      values.push(data.size_bytes || data.sizeBytes);
    }
    if (data.token_usage !== undefined || data.tokenUsage !== undefined) {
      updates.push('token_usage = ?');
      const usage = data.token_usage || data.tokenUsage;
      values.push(typeof usage === 'string' ? usage : JSON.stringify(usage));
    }
    if (data.tool_usage !== undefined || data.toolUsage !== undefined) {
      updates.push('tool_usage = ?');
      const usage = data.tool_usage || data.toolUsage;
      values.push(typeof usage === 'string' ? usage : JSON.stringify(usage));
    }
    if (data.model !== undefined) {
      updates.push('model = ?');
      values.push(data.model);
    }
    if (data.error_count !== undefined || data.errorCount !== undefined) {
      updates.push('error_count = ?');
      values.push(data.error_count || data.errorCount);
    }
    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      values.push(typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata));
    }
    
    if (updates.length > 0) {
      values.push(id);
      
      await this.db.run(`
        UPDATE claude_sessions 
        SET ${updates.join(', ')}
        WHERE id = ?
      `, values);
    }
    
    return this.findById(id);
  }

  async getSessionAnalytics(taskId = null) {
    let where = '';
    const params = [];
    
    if (taskId) {
      where = 'WHERE cs.task_id = ?';
      params.push(taskId);
    }
    
    const analytics = await this.db.get(`
      SELECT 
        COUNT(DISTINCT cs.id) as total_sessions,
        COUNT(DISTINCT cs.task_id) as total_tasks,
        SUM(cs.message_count) as total_messages,
        SUM(cs.size_bytes) as total_size,
        SUM(json_extract(cs.token_usage, '$.totalInputTokens')) as total_input_tokens,
        SUM(json_extract(cs.token_usage, '$.totalOutputTokens')) as total_output_tokens,
        SUM(json_extract(cs.token_usage, '$.totalCacheRead')) as total_cache_read,
        SUM(json_extract(cs.token_usage, '$.totalCacheCreated')) as total_cache_created,
        SUM(cs.error_count) as total_errors,
        MAX(cs.last_activity) as last_activity
      FROM claude_sessions cs
      ${where}
    `, params);

    return analytics;
  }

  _parseSession(session) {
    if (!session) return null;
    
    try {
      session.token_usage = JSON.parse(session.token_usage || '{}');
    } catch (e) {
      session.token_usage = {};
    }
    
    try {
      session.tool_usage = JSON.parse(session.tool_usage || '{}');
    } catch (e) {
      session.tool_usage = {};
    }
    
    try {
      session.metadata = JSON.parse(session.metadata || '{}');
    } catch (e) {
      session.metadata = {};
    }
    
    return session;
  }
}

export default SessionModel;