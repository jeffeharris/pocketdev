import ProjectModel from './project.js';
import TaskModel from './task.js';
import SessionModel from './session.js';

class Models {
  constructor(db) {
    this.projects = new ProjectModel(db);
    this.tasks = new TaskModel(db);
    this.sessions = new SessionModel(db);
    this.db = db;
  }

  // Utility methods
  async getWorktreeRegistry() {
    return this.db.all(`
      SELECT wr.*, 
        t.name as task_name, 
        t.status as task_status,
        p.name as project_name
      FROM worktree_registry wr
      LEFT JOIN tasks t ON wr.task_id = t.id
      LEFT JOIN projects p ON wr.project_id = p.id
      ORDER BY wr.created_at DESC
    `);
  }

  async getOrphanedWorktrees() {
    return this.db.all(`
      SELECT wr.*, 
        CASE 
          WHEN t.id IS NULL AND p.id IS NULL THEN 'no_references'
          WHEN t.is_archived = 1 THEN 'task_archived'
          WHEN p.is_archived = 1 THEN 'project_archived'
          ELSE 'unknown'
        END as orphan_reason
      FROM worktree_registry wr
      LEFT JOIN tasks t ON wr.task_id = t.id
      LEFT JOIN projects p ON wr.project_id = p.id
      WHERE wr.is_orphaned = 1 
        OR t.id IS NULL 
        OR p.id IS NULL 
        OR t.is_archived = 1 
        OR p.is_archived = 1
    `);
  }

  async markWorktreeOrphaned(path) {
    return this.db.run(`
      UPDATE worktree_registry 
      SET is_orphaned = 1 
      WHERE path = ?
    `, [path]);
  }

  async removeWorktreeRegistration(path) {
    return this.db.run('DELETE FROM worktree_registry WHERE path = ?', [path]);
  }

  async getSetting(key) {
    const result = await this.db.get('SELECT value FROM settings WHERE key = ?', [key]);
    return result ? result.value : null;
  }

  async setSetting(key, value) {
    await this.db.run(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `, [key, value]);
  }

  async getStats() {
    const stats = await this.db.get(`
      SELECT 
        (SELECT COUNT(*) FROM projects WHERE is_archived = 0) as active_projects,
        (SELECT COUNT(*) FROM tasks WHERE is_archived = 0) as active_tasks,
        (SELECT COUNT(*) FROM claude_sessions) as total_sessions,
        (SELECT COUNT(*) FROM worktree_registry WHERE is_orphaned = 1) as orphaned_worktrees
    `);

    return stats;
  }
}

export default Models;