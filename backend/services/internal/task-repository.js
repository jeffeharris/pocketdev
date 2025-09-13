/**
 * TaskRepository - Handles all database operations for tasks
 * This is an internal service used by TaskService
 */
export class TaskRepository {
  constructor(models) {
    this.models = models;
  }

  /**
   * Create a new task in the database
   */
  async create(taskData) {
    const task = await this.models.tasks.create(taskData);
    await this.models.projects.updateLastAccessed(task.project_id);
    return task;
  }

  /**
   * Find a task by ID
   */
  async findById(taskId) {
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      const error = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }
    return task;
  }

  /**
   * Find tasks by project ID
   */
  async findByProjectId(projectId) {
    return this.models.tasks.findByProjectId(projectId);
  }

  /**
   * Update task metadata
   */
  async update(taskId, updates) {
    // Validate allowed updates
    const allowedUpdates = ['name', 'description', 'split_layout', 'status', 'metadata', 
                           'merged_at', 'merge_commit_sha', 'has_commits_since_merge'];
    const filteredUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = value;
      }
    }
    
    if (Object.keys(filteredUpdates).length === 0) {
      throw new Error('No valid updates provided');
    }
    
    return await this.models.tasks.update(taskId, filteredUpdates);
  }

  /**
   * Archive a task (soft delete)
   */
  async archive(taskId) {
    return await this.models.tasks.archive(taskId);
  }

  /**
   * Delete a task (hard delete)
   */
  async delete(taskId) {
    return await this.models.tasks.delete(taskId);
  }

  /**
   * Get task with sessions
   */
  async getTaskWithSessions(taskId) {
    const task = await this.findById(taskId);
    const sessions = await this.models.sessions.findByTaskId(taskId);
    
    task.sessions = sessions;
    task.active_session_count = sessions.filter(s => s.is_active).length;
    
    // Add session state from active sessions
    const activeSession = sessions.find(s => s.is_active);
    if (activeSession) {
      task.sessionState = {
        state: activeSession.ai_state,
        lastActivity: activeSession.last_activity
      };
    }
    
    return task;
  }

  /**
   * Get project for a task
   */
  async getProject(taskId) {
    const task = await this.findById(taskId);
    const project = await this.models.projects.findById(task.project_id);
    if (!project) {
      throw new Error('Project not found for task');
    }
    return project;
  }

  /**
   * Check if task has active sessions
   */
  async hasActiveSessions(taskId) {
    const sessions = await this.models.sessions.findByTaskId(taskId);
    return sessions.some(s => s.is_active);
  }

  /**
   * Get terminals for a task
   */
  async getTerminals(taskId, limit = 6) {
    return await this.models.terminals.findByTaskId(taskId, limit);
  }
}