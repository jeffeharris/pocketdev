/**
 * TaskModel - Pure Single-Table Model
 * 
 * Only queries the tasks table. No joins to projects or terminal_sessions.
 * Cross-table operations moved to TaskService.
 */
import BaseModel from './base-model.js';
import { v4 as uuidv4 } from 'uuid';

class TaskModel extends BaseModel {
  constructor(db) {
    super(db, 'tasks');
    this.jsonFields = ['metadata'];
  }

  /**
   * Create a new task
   * @param {Object} taskData
   * @returns {Promise<Object>} The created task
   */
  async create(taskData) {
    const task = {
      id: taskData.id || uuidv4(),
      project_id: taskData.project_id,
      name: taskData.name,
      branch: taskData.branch,
      worktree_path: taskData.worktree_path,
      status: taskData.status || 'active',
      is_archived: taskData.is_archived || 0,
      has_uncommitted_changes: taskData.has_uncommitted_changes || 0,
      last_commit_sha: taskData.last_commit_sha || null,
      merged_at: taskData.merged_at || null,
      merge_commit_sha: taskData.merge_commit_sha || null,
      has_commits_since_merge: taskData.has_commits_since_merge || 0,
      metadata: taskData.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: taskData.completed_at || null
    };

    return super.create(task);
  }

  /**
   * Find all tasks for a project
   * @param {string} projectId
   * @param {Object|boolean} options - Options object or includeArchived boolean for backward compatibility
   * @returns {Promise<Array>}
   */
  async findByProjectId(projectId, options = {}) {
    // Handle legacy boolean parameter
    if (typeof options === 'boolean') {
      options = { includeArchived: options };
    }
    
    const conditions = { project_id: projectId };
    if (!options.includeArchived) {
      conditions.is_archived = 0;
    }
    
    return this.findAll(conditions);
  }

  /**
   * Find active tasks for a project
   * @param {string} projectId
   * @returns {Promise<Array>}
   */
  async findActiveByProjectId(projectId) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE project_id = ? AND is_archived = 0 AND status = 'active'
      ORDER BY updated_at DESC
    `;
    
    const results = await this.db.all(query, [projectId]);
    return this.parseJsonFieldsMany(results);
  }

  /**
   * Find archived tasks for a project
   * @param {string} projectId
   * @returns {Promise<Array>}
   */
  async findArchivedByProjectId(projectId) {
    return this.findAll({ project_id: projectId, is_archived: 1 });
  }

  /**
   * Find task by branch name within a project
   * @param {string} projectId
   * @param {string} branch
   * @returns {Promise<Object|null>}
   */
  async findByBranch(projectId, branch) {
    return this.findOne({ 
      project_id: projectId, 
      branch: branch,
      is_archived: 0
    });
  }

  /**
   * Find task by worktree path
   * @param {string} worktreePath
   * @returns {Promise<Object|null>}
   */
  async findByWorktreePath(worktreePath) {
    return this.findOne({ worktree_path: worktreePath });
  }

  /**
   * Update task status
   * @param {string} id
   * @param {string} status
   * @returns {Promise<Object|null>}
   */
  async updateStatus(id, status) {
    const updates = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    return this.update(id, updates);
  }

  /**
   * Archive a task
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async archive(id) {
    return this.update(id, {
      is_archived: 1,
      updated_at: new Date().toISOString()
    });
  }

  /**
   * Unarchive a task
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async unarchive(id) {
    return this.update(id, {
      is_archived: 0,
      updated_at: new Date().toISOString()
    });
  }

  /**
   * Update git status fields
   * @param {string} id
   * @param {Object} gitStatus
   * @returns {Promise<Object|null>}
   */
  async updateGitStatus(id, gitStatus) {
    const updates = {
      updated_at: new Date().toISOString()
    };

    if ('has_uncommitted_changes' in gitStatus) {
      updates.has_uncommitted_changes = gitStatus.has_uncommitted_changes ? 1 : 0;
    }

    if ('last_commit_sha' in gitStatus) {
      updates.last_commit_sha = gitStatus.last_commit_sha;
    }

    return this.update(id, updates);
  }

  /**
   * Update merge information
   * @param {string} id
   * @param {Object} mergeInfo
   * @returns {Promise<Object|null>}
   */
  async updateMergeInfo(id, mergeInfo) {
    const updates = {
      merged_at: mergeInfo.merged_at || new Date().toISOString(),
      merge_commit_sha: mergeInfo.merge_commit_sha,
      updated_at: new Date().toISOString()
    };

    return this.update(id, updates);
  }

  /**
   * Get tasks with uncommitted changes
   * @param {string} projectId - Optional project filter
   * @returns {Promise<Array>}
   */
  async findWithUncommittedChanges(projectId = null) {
    let query = `
      SELECT * FROM ${this.tableName}
      WHERE has_uncommitted_changes = 1 AND is_archived = 0
    `;
    
    const params = [];
    if (projectId) {
      query += ' AND project_id = ?';
      params.push(projectId);
    }
    
    query += ' ORDER BY updated_at DESC';
    
    const results = await this.db.all(query, params);
    return this.parseJsonFieldsMany(results);
  }

  /**
   * Count active tasks for a project
   * @param {string} projectId
   * @returns {Promise<number>}
   */
  async countByProjectId(projectId) {
    return this.count({ project_id: projectId, is_archived: 0 });
  }

  /**
   * Get recently updated tasks
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async findRecent(limit = 10) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE is_archived = 0
      ORDER BY updated_at DESC
      LIMIT ?
    `;
    
    const results = await this.db.all(query, [limit]);
    return this.parseJsonFieldsMany(results);
  }

  /**
   * Update task metadata
   * @param {string} id
   * @param {Object} metadata
   * @returns {Promise<Object|null>}
   */
  async updateMetadata(id, metadata) {
    const task = await this.findById(id);
    if (!task) return null;

    const updatedMetadata = {
      ...(task.metadata || {}),
      ...metadata
    };

    return this.update(id, {
      metadata: updatedMetadata,
      updated_at: new Date().toISOString()
    });
  }

  /**
   * Mark task as having commits since merge
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async markHasCommitsSinceMerge(id) {
    return this.update(id, {
      has_commits_since_merge: 1,
      updated_at: new Date().toISOString()
    });
  }
}

export default TaskModel;