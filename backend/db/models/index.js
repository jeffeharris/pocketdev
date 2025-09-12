// Import pure models that only query their own tables
import ProjectModel from './project-pure.js';
import TaskModel from './task-pure.js';
import SessionModel from './session-pure.js';
import WorktreeRegistryModel from './worktree-registry-pure.js';
import SettingsModel from './settings-pure.js';

/**
 * Models - Factory for database models
 * 
 * This class now only instantiates pure models.
 * Cross-table operations have been moved to the service layer.
 * 
 * NOTE: Methods like getWorktreeRegistry() that perform cross-table
 * queries have been removed. Use WorktreeService instead.
 */
class Models {
  constructor(db) {
    // Pure single-table models
    this.projects = new ProjectModel(db);
    this.tasks = new TaskModel(db);
    this.sessions = new SessionModel(db);
    this.worktreeRegistry = new WorktreeRegistryModel(db);
    this.settings = new SettingsModel(db);
    
    // Keep db reference for any remaining needs
    this.db = db;
    
    // Alias for backward compatibility during migration
    this.terminalSession = this.sessions; // Some code uses terminalSession
  }

  // Settings convenience methods (delegating to SettingsModel)
  async getSetting(key) {
    return this.settings.get(key);
  }

  async setSetting(key, value) {
    return this.settings.set(key, value);
  }

  // Worktree convenience methods (delegating to WorktreeRegistryModel)
  async markWorktreeOrphaned(path) {
    return this.worktreeRegistry.markOrphaned(path);
  }

  async removeWorktreeRegistration(path) {
    return this.worktreeRegistry.deleteByPath(path);
  }

  // Stats method needs to use individual model counts
  async getStats() {
    const [activeProjects, activeTasks, totalSessions, orphanedWorktrees] = await Promise.all([
      this.projects.countActive(),
      this.tasks.count({ is_archived: 0 }),
      this.sessions.count({}),
      this.worktreeRegistry.countOrphaned()
    ]);

    return {
      active_projects: activeProjects,
      active_tasks: activeTasks,
      total_sessions: totalSessions,
      orphaned_worktrees: orphanedWorktrees
    };
  }

  // TEMPORARY: Keep these methods until services are updated (Chunk 4)
  async getOrphanedWorktrees() {
    // This needs to move to WorktreeService
    // For now, return orphaned worktrees without the cross-table data
    const orphaned = await this.worktreeRegistry.findOrphaned();
    
    // Add minimal data for backward compatibility
    return orphaned.map(w => ({
      ...w,
      orphan_reason: w.is_orphaned ? 'orphaned' : 'unknown'
    }));
  }
  
  async getWorktreeRegistry() {
    // This needs to move to WorktreeService
    // For now, return worktrees without cross-table data
    return this.worktreeRegistry.findAll({});
  }
}

export default Models;