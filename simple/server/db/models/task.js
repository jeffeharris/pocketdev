import crypto from 'crypto';

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

  async findAll(includeArchived = false) {
    const where = includeArchived ? '' : 'WHERE t.is_archived = 0';
    
    const tasks = await this.db.all(`
      SELECT t.*,
        p.name as project_name,
        COUNT(DISTINCT cs.id) as session_count,
        COUNT(DISTINCT CASE WHEN cs.is_active = 1 THEN cs.id END) as active_session_count
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN claude_sessions cs ON t.id = cs.task_id
      ${where}
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);

    return tasks.map(t => {
      if (t.metadata) {
        try {
          t.metadata = JSON.parse(t.metadata);
        } catch (e) {
          t.metadata = {};
        }
      }
      return t;
    });
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

    return tasks.map(t => {
      if (t.metadata) {
        try {
          t.metadata = JSON.parse(t.metadata);
        } catch (e) {
          t.metadata = {};
        }
      }
      return t;
    });
  }

  async update(id, data) {
    const updates = [];
    const values = [];
    
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.has_uncommitted_changes !== undefined) {
      updates.push('has_uncommitted_changes = ?');
      values.push(data.has_uncommitted_changes ? 1 : 0);
    }
    if (data.has_commits_since_merge !== undefined) {
      updates.push('has_commits_since_merge = ?');
      values.push(data.has_commits_since_merge ? 1 : 0);
    }
    if (data.completed_at !== undefined) {
      updates.push('completed_at = ?');
      values.push(data.completed_at);
    }
    if (data.merged_at !== undefined) {
      updates.push('merged_at = ?');
      values.push(data.merged_at);
    }
    if (data.merge_commit_sha !== undefined) {
      updates.push('merge_commit_sha = ?');
      values.push(data.merge_commit_sha);
    }
    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      values.push(typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata));
    }
    
    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      
      await this.db.run(`
        UPDATE tasks 
        SET ${updates.join(', ')}
        WHERE id = ?
      `, values);
    }
    
    return this.findById(id);
  }

  async archive(id) {
    await this.db.run(`
      UPDATE tasks 
      SET is_archived = 1, updated_at = CURRENT_TIMESTAMP 
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
    // Get worktree path first
    const task = await this.db.get('SELECT worktree_path FROM tasks WHERE id = ?', [id]);
    
    // Delete task (cascades to sessions)
    await this.db.run('DELETE FROM tasks WHERE id = ?', [id]);
    
    // Remove from worktree registry
    if (task && task.worktree_path) {
      await this.db.run('DELETE FROM worktree_registry WHERE path = ?', [task.worktree_path]);
    }
  }

  /**
   * Get task with enriched session state information
   */
  async findByIdWithSessionState(id) {
    const task = await this.findById(id);
    if (!task) return null;

    // Get active session state if exists
    const session = await this.db.get(`
      SELECT id, ai_state, ai_state_updated_at
      FROM claude_sessions
      WHERE task_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 1
    `, [id]);

    // Calculate task state based on status
    let taskState = 'active';
    if (task.status === 'merged' || task.merged_at) {
      taskState = 'merged';
    } else if (task.is_archived) {
      taskState = 'archived';
    }

    // Add session state to task
    return {
      ...task,
      taskState,
      sessionState: session ? {
        status: session.ai_state || 'idle',
        lastStateChange: session.ai_state_updated_at
      } : {
        status: 'not-started',
        lastStateChange: null
      }
    };
  }

  /**
   * Get all tasks for a project with session states
   */
  async findByProjectIdWithSessionStates(projectId, includeArchived = false) {
    const tasks = await this.findByProjectId(projectId, includeArchived);
    
    // Get all active sessions for these tasks
    const taskIds = tasks.map(t => t.id);
    if (taskIds.length === 0) return [];
    
    const sessions = await this.db.all(`
      SELECT task_id, id, ai_state, ai_state_updated_at
      FROM claude_sessions
      WHERE task_id IN (${taskIds.map(() => '?').join(',')}) 
        AND is_active = 1
    `, taskIds);

    // Create a map of task_id to session for quick lookup
    const sessionMap = new Map();
    sessions.forEach(session => {
      sessionMap.set(session.task_id, session);
    });

    // Enrich tasks with session state
    return tasks.map(task => {
      const session = sessionMap.get(task.id);
      
      // Calculate task state
      let taskState = 'active';
      if (task.status === 'merged' || task.merged_at) {
        taskState = 'merged';
      } else if (task.is_archived) {
        taskState = 'archived';
      }

      return {
        ...task,
        taskState,
        sessionState: session ? {
          status: session.ai_state || 'idle',
          lastStateChange: session.ai_state_updated_at
        } : {
          status: 'not-started',
          lastStateChange: null
        }
      };
    });
  }
}

export default TaskModel;