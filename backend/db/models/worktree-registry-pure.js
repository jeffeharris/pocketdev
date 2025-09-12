/**
 * WorktreeRegistryModel - Pure Single-Table Model
 * 
 * Only queries the worktree_registry table.
 * Cross-table operations moved to WorktreeService.
 */
import BaseModel from './base-model.js';

class WorktreeRegistryModel extends BaseModel {
  constructor(db) {
    super(db, 'worktree_registry');
    this.jsonFields = []; // No JSON fields in this table
  }

  /**
   * Create a new worktree registration
   * @param {Object} worktreeData
   * @returns {Promise<Object>} The created worktree registration
   */
  async create(worktreeData) {
    const worktree = {
      path: worktreeData.path,
      task_id: worktreeData.task_id || null,
      project_id: worktreeData.project_id || null,
      is_orphaned: worktreeData.is_orphaned || 0,
      created_at: new Date().toISOString(),
      last_seen: new Date().toISOString()
    };

    // Use raw SQL since path is the primary key, not id
    const query = `
      INSERT INTO ${this.tableName} (path, task_id, project_id, is_orphaned, created_at, last_seen)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.run(query, [
      worktree.path,
      worktree.task_id,
      worktree.project_id,
      worktree.is_orphaned,
      worktree.created_at,
      worktree.last_seen
    ]);

    return this.findByPath(worktree.path);
  }

  /**
   * Find by path (primary key)
   * @param {string} path
   * @returns {Promise<Object|null>}
   */
  async findByPath(path) {
    const record = await this.db.get(
      `SELECT * FROM ${this.tableName} WHERE path = ?`,
      [path]
    );
    return this.parseJsonFields(record);
  }

  /**
   * Find all worktrees for a task
   * @param {string} taskId
   * @returns {Promise<Array>}
   */
  async findByTaskId(taskId) {
    return this.findAll({ task_id: taskId });
  }

  /**
   * Find all worktrees for a project
   * @param {string} projectId
   * @returns {Promise<Array>}
   */
  async findByProjectId(projectId) {
    return this.findAll({ project_id: projectId });
  }

  /**
   * Find orphaned worktrees
   * @returns {Promise<Array>}
   */
  async findOrphaned() {
    return this.findAll({ is_orphaned: 1 });
  }

  /**
   * Find active (non-orphaned) worktrees
   * @returns {Promise<Array>}
   */
  async findActive() {
    return this.findAll({ is_orphaned: 0 });
  }

  /**
   * Mark worktree as orphaned
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  async markOrphaned(path) {
    const result = await this.db.run(
      `UPDATE ${this.tableName} SET is_orphaned = 1 WHERE path = ?`,
      [path]
    );
    return result.changes > 0;
  }

  /**
   * Mark worktree as active (not orphaned)
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  async markActive(path) {
    const result = await this.db.run(
      `UPDATE ${this.tableName} SET is_orphaned = 0 WHERE path = ?`,
      [path]
    );
    return result.changes > 0;
  }

  /**
   * Update last seen timestamp
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  async updateLastSeen(path) {
    const result = await this.db.run(
      `UPDATE ${this.tableName} SET last_seen = CURRENT_TIMESTAMP WHERE path = ?`,
      [path]
    );
    return result.changes > 0;
  }

  /**
   * Update worktree by path (since path is primary key)
   * @param {string} path
   * @param {Object} updates
   * @returns {Promise<Object|null>}
   */
  async updateByPath(path, updates) {
    const prepared = this.stringifyJsonFields(updates);
    const fields = Object.keys(prepared);
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = [...fields.map(field => prepared[field]), path];
    
    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE path = ?
    `;
    
    await this.db.run(query, values);
    return this.findByPath(path);
  }

  /**
   * Delete by path
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  async deleteByPath(path) {
    const result = await this.db.run(
      `DELETE FROM ${this.tableName} WHERE path = ?`,
      [path]
    );
    return result.changes > 0;
  }

  /**
   * Find stale worktrees (not seen recently)
   * @param {number} daysAgo
   * @returns {Promise<Array>}
   */
  async findStale(daysAgo = 7) {
    const cutoffTime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE last_seen < ?
      ORDER BY last_seen ASC
    `;
    
    const results = await this.db.all(query, [cutoffTime]);
    return this.parseJsonFieldsMany(results);
  }

  /**
   * Find worktrees without task or project references
   * @returns {Promise<Array>}
   */
  async findDetached() {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE task_id IS NULL OR project_id IS NULL
      ORDER BY created_at DESC
    `;
    
    const results = await this.db.all(query);
    return this.parseJsonFieldsMany(results);
  }

  /**
   * Count orphaned worktrees
   * @returns {Promise<number>}
   */
  async countOrphaned() {
    return this.count({ is_orphaned: 1 });
  }

  /**
   * Count active worktrees
   * @returns {Promise<number>}
   */
  async countActive() {
    return this.count({ is_orphaned: 0 });
  }

  /**
   * Reassign worktree to different task
   * @param {string} path
   * @param {string} newTaskId
   * @param {string} newProjectId
   * @returns {Promise<Object|null>}
   */
  async reassign(path, newTaskId, newProjectId) {
    return this.updateByPath(path, {
      task_id: newTaskId,
      project_id: newProjectId,
      is_orphaned: 0,
      last_seen: new Date().toISOString()
    });
  }
}

export default WorktreeRegistryModel;