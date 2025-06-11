const crypto = require('crypto');

class TaskModel {
  constructor(db) {
    this.db = db;
  }

  generateId() {
    return crypto.randomBytes(4).toString('hex');
  }

  async create(projectId, data) {
    const id = data.id || this.generateId();
    const now = new Date().toISOString();
    
    const worktreePath = data.worktreePath || data.worktree_path || 
                        `projects/${projectId}-task-${id}`;
    
    const result = await this.db.run(`
      INSERT INTO tasks (id, project_id, name, branch, worktree_path, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, projectId, data.name, data.branch, worktreePath, 'active', now, now]);

    // Also register the worktree
    await this.db.run(`
      INSERT OR IGNORE INTO worktree_registry (path, task_id, project_id, created_at)
      VALUES (?, ?, ?, ?)
    `, [worktreePath, id, projectId, now]);

    return this.findById(id);
  }

  async findById(id) {
    const task = await this.db.get(`
      SELECT t.*,
        p.name as project_name,
        p.repo_url as project_repo_url,
        COUNT(DISTINCT cs.id) as session_count,
        COUNT(DISTINCT CASE WHEN cs.is_active = 1 THEN cs.id END) as active_session_count
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN claude_sessions cs ON t.id = cs.task_id
      WHERE t.id = ?
      GROUP BY t.id
    `, [id]);

    if (task && task.metadata) {
      try {
        task.metadata = JSON.parse(task.metadata);
      } catch (e) {
        task.metadata = {};
      }
    }

    return task;
  }

  async findByProjectId(projectId, includeArchived = false) {
    const where = includeArchived ? 
      'WHERE t.project_id = ?' : 
      'WHERE t.project_id = ? AND t.is_archived = 0';
    
    const tasks = await this.db.all(`
      SELECT t.*,
        COUNT(DISTINCT cs.id) as session_count,
        COUNT(DISTINCT CASE WHEN cs.is_active = 1 THEN cs.id END) as active_session_count
      FROM tasks t
      LEFT JOIN claude_sessions cs ON t.id = cs.task_id
      ${where}
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `, [projectId]);

    // Parse metadata
    for (const task of tasks) {
      if (task.metadata) {
        try {
          task.metadata = JSON.parse(task.metadata);
        } catch (e) {
          task.metadata = {};
        }
      }
    }

    return tasks;
  }

  async update(id, data) {
    const fields = [];
    const values = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.branch !== undefined) {
      fields.push('branch = ?');
      values.push(data.branch);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
      
      if (data.status === 'completed') {
        fields.push('completed_at = CURRENT_TIMESTAMP');
      }
    }
    if (data.hasUncommittedChanges !== undefined || data.has_uncommitted_changes !== undefined) {
      fields.push('has_uncommitted_changes = ?');
      values.push(data.hasUncommittedChanges || data.has_uncommitted_changes ? 1 : 0);
    }
    if (data.lastCommitSha !== undefined || data.last_commit_sha !== undefined) {
      fields.push('last_commit_sha = ?');
      values.push(data.lastCommitSha || data.last_commit_sha);
    }
    if (data.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(JSON.stringify(data.metadata));
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await this.db.run(`
      UPDATE tasks 
      SET ${fields.join(', ')}
      WHERE id = ?
    `, values);

    return this.findById(id);
  }

  async archive(id) {
    await this.db.run(`
      UPDATE tasks 
      SET is_archived = 1, status = 'archived'
      WHERE id = ?
    `, [id]);

    // Mark worktree as orphaned
    await this.db.run(`
      UPDATE worktree_registry 
      SET is_orphaned = 1
      WHERE task_id = ?
    `, [id]);
  }

  async delete(id) {
    // Get worktree path before deletion
    const task = await this.db.get('SELECT worktree_path FROM tasks WHERE id = ?', [id]);
    
    // Delete task (cascades to sessions)
    await this.db.run('DELETE FROM tasks WHERE id = ?', [id]);
    
    // Mark worktree as orphaned
    if (task && task.worktree_path) {
      await this.db.run(`
        UPDATE worktree_registry 
        SET is_orphaned = 1, task_id = NULL
        WHERE path = ?
      `, [task.worktree_path]);
    }
  }

  async getActiveTaskCount(projectId) {
    const result = await this.db.get(`
      SELECT COUNT(*) as count
      FROM tasks
      WHERE project_id = ? AND status = 'active' AND is_archived = 0
    `, [projectId]);
    
    return result.count;
  }

  async checkForUncommittedChanges(id) {
    const task = await this.findById(id);
    if (!task) return null;

    // This would be called by the git helper
    // For now, just return the stored value
    return task.has_uncommitted_changes;
  }
}

module.exports = TaskModel;