import crypto from 'crypto';

// Map backend AI states to frontend task statuses
const mapAIStateToTaskStatus = (aiState) => {
  // With our new implementation, backend states match frontend exactly
  const validStates = ['not-started', 'idle', 'working', 'waiting'];
  
  // If it's a valid state, return it directly
  if (validStates.includes(aiState)) {
    return aiState;
  }
  
  // Default to not-started if no state or invalid state
  return 'not-started';
};

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
        COUNT(DISTINCT ts.id) as session_count,
        COUNT(DISTINCT CASE WHEN ts.is_active = 1 THEN ts.id END) as active_session_count
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN terminal_sessions ts ON t.id = ts.task_id
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

    if (task && task.split_layout) {
      try {
        task.split_layout = JSON.parse(task.split_layout);
      } catch (e) {
        task.split_layout = null;
      }
    }

    return task;
  }

  async findAll(includeArchived = false) {
    const where = includeArchived ? '' : 'WHERE t.is_archived = 0';
    
    const tasks = await this.db.all(`
      SELECT t.*,
        p.name as project_name,
        COUNT(DISTINCT ts.id) as session_count,
        COUNT(DISTINCT CASE WHEN ts.is_active = 1 THEN ts.id END) as active_session_count
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      LEFT JOIN terminal_sessions ts ON t.id = ts.task_id
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
      if (t.split_layout) {
        try {
          t.split_layout = JSON.parse(t.split_layout);
        } catch (e) {
          t.split_layout = null;
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
        COUNT(DISTINCT ts.id) as session_count,
        COUNT(DISTINCT CASE WHEN ts.is_active = 1 THEN ts.id END) as active_session_count
      FROM tasks t
      LEFT JOIN terminal_sessions ts ON t.id = ts.task_id
      ${where}
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `, [projectId]);

    // Get all active sessions for these tasks to enrich with AI state
    const taskIds = tasks.map(t => t.id);
    if (taskIds.length === 0) return [];
    
    const sessions = await this.db.all(`
      SELECT task_id, id, ai_state, ai_state_updated_at, shelltender_session_id, tab_name
      FROM terminal_sessions
      WHERE task_id IN (${taskIds.map(() => '?').join(',')}) 
        AND is_active = 1
      ORDER BY task_id, tab_order ASC
    `, taskIds);

    // Create a map of task_id to sessions array for quick lookup
    const sessionMap = new Map();
    sessions.forEach(session => {
      if (!sessionMap.has(session.task_id)) {
        sessionMap.set(session.task_id, []);
      }
      sessionMap.get(session.task_id).push(session);
    });

    // Enrich tasks with session state and parse metadata
    return tasks.map(t => {
      if (t.metadata) {
        try {
          t.metadata = JSON.parse(t.metadata);
        } catch (e) {
          t.metadata = {};
        }
      }
      if (t.split_layout) {
        try {
          t.split_layout = JSON.parse(t.split_layout);
        } catch (e) {
          t.split_layout = null;
        }
      }
      
      // Add session state with aggregation for multiple sessions
      const sessions = sessionMap.get(t.id) || [];
      
      /**
       * Task State Machine
       * 
       * Task states determine the lifecycle phase of a task:
       * - 'active': Task is being worked on (default for new tasks)
       * - 'merged': Task has been merged into base branch (terminal state)
       * - 'archived': Task has been soft-deleted (terminal state)
       * 
       * State transitions:
       * - active → merged (when PR is merged or commits are merged)
       * - active → archived (when task is abandoned/deleted)
       * - merged → archived (cleanup old merged tasks)
       * 
       * Related states tracked separately:
       * - AI Session State: not-started, idle, working, waiting
       * - Git State: has_uncommitted_changes, has_commits_since_merge
       * - PR State: pr_status (null, open, merged, closed)
       * 
       * These states combine to trigger "Needs Attention" items in the dashboard:
       * - Stale tasks (active + no recent commits)
       * - Merge conflicts (active + conflicts with base)
       * - Open PRs (active + pr_status='open')
       * - AI waiting for input (active + ai_state='waiting')
       * 
       * @see getProjectDashboard in project.controller.js for attention logic
       * @see /docs/task-state-machine-documentation.md for detailed documentation
       */
      // Calculate task state
      let taskState = 'active';
      if (t.status === 'merged' || t.merged_at) {
        taskState = 'merged';
      } else if (t.is_archived) {
        taskState = 'archived';
      }

      // Calculate aggregated session state for multiple terminals
      let aggregatedState = 'not-started';
      let latestStateChange = null;
      
      if (sessions.length > 0) {
        // Get all AI states
        const states = sessions.map(s => s.ai_state || 'not-started');
        
        // Priority: waiting > working > idle > not-started
        if (states.includes('waiting')) {
          aggregatedState = 'waiting';
        } else if (states.includes('working')) {
          aggregatedState = 'working';
        } else if (states.includes('idle')) {
          aggregatedState = 'idle';
        } else {
          aggregatedState = 'not-started';
        }
        
        // Get the most recent state change time
        const stateChangeTimes = sessions
          .filter(s => s.ai_state_updated_at)
          .map(s => new Date(s.ai_state_updated_at).getTime());
        
        if (stateChangeTimes.length > 0) {
          latestStateChange = new Date(Math.max(...stateChangeTimes)).toISOString();
        }
      }

      return {
        ...t,
        taskState,
        sessionState: {
          status: mapAIStateToTaskStatus(aggregatedState),
          lastStateChange: latestStateChange
        },
        // Include individual session states for frontend
        sessionStates: sessions.map(s => ({
          id: s.id,
          shelltenderSessionId: s.shelltender_session_id,
          tabName: s.tab_name,
          aiState: s.ai_state || 'not-started'
        }))
      };
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
    if (data.split_layout !== undefined) {
      updates.push('split_layout = ?');
      values.push(typeof data.split_layout === 'string' ? data.split_layout : JSON.stringify(data.split_layout));
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

    // Get all active sessions for aggregated state
    const sessions = await this.db.all(`
      SELECT id, ai_state, ai_state_updated_at, shelltender_session_id, tab_name
      FROM terminal_sessions
      WHERE task_id = ? AND is_active = 1
      ORDER BY tab_order ASC
    `, [id]);

    // Calculate task state based on status
    let taskState = 'active';
    if (task.status === 'merged' || task.merged_at) {
      taskState = 'merged';
    } else if (task.is_archived) {
      taskState = 'archived';
    }

    // Calculate aggregated session state
    let aggregatedState = 'not-started';
    let latestStateChange = null;
    
    if (sessions.length > 0) {
      // Get all AI states
      const states = sessions.map(s => s.ai_state || 'not-started');
      
      // Priority: waiting > working > idle > not-started
      if (states.includes('waiting')) {
        aggregatedState = 'waiting';
      } else if (states.includes('working')) {
        aggregatedState = 'working';
      } else if (states.includes('idle')) {
        aggregatedState = 'idle';
      } else {
        aggregatedState = 'not-started';
      }
      
      // Get the most recent state change time
      const stateChangeTimes = sessions
        .filter(s => s.ai_state_updated_at)
        .map(s => new Date(s.ai_state_updated_at).getTime());
      
      if (stateChangeTimes.length > 0) {
        latestStateChange = new Date(Math.max(...stateChangeTimes)).toISOString();
      }
    }

    // Add session state to task
    return {
      ...task,
      taskState,
      sessionState: {
        status: mapAIStateToTaskStatus(aggregatedState),
        lastStateChange: latestStateChange
      },
      // Include individual session states for tooltip
      sessionStates: sessions.map(s => ({
        id: s.id,
        shelltenderSessionId: s.shelltender_session_id,
        tabName: s.tab_name,
        aiState: s.ai_state || 'not-started',
        lastStateChange: s.ai_state_updated_at
      }))
    };
  }

}

export default TaskModel;