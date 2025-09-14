import { Task, NotFoundError, ValidationError } from '../../shared/domain/index.js';

/**
 * TaskRepository - Handles Task domain object persistence
 * Lightweight repository that converts between domain objects and database
 */
export class TaskRepository {
  constructor(models) {
    this.models = models;
  }
  
  /**
   * Find a task by ID and return domain object
   */
  async findById(id) {
    const data = await this.models.tasks.findById(id);
    if (!data) {
      throw new NotFoundError('Task', id);
    }
    
    return Task.fromDatabase(data);
  }
  
  /**
   * Find all tasks for a project
   */
  async findByProject(projectId) {
    const rows = await this.models.tasks.findByProjectId(projectId);
    return rows.map(row => Task.fromDatabase(row));
  }
  
  /**
   * Find active tasks (not archived)
   */
  async findActive(projectId = null) {
    const allTasks = projectId 
      ? await this.findByProject(projectId)
      : await this.findAll();
    
    return allTasks.filter(task => task.state === 'active');
  }
  
  /**
   * Find all tasks
   */
  async findAll() {
    const rows = await this.models.tasks.findAll();
    return rows.map(row => Task.fromDatabase(row));
  }
  
  /**
   * Save a task domain object to database
   */
  async save(task) {
    const dbFormat = task.toDatabaseFormat();
    
    // Add timestamps
    const now = new Date().toISOString();
    if (await this.exists(task.id)) {
      dbFormat.updated_at = now;
      
      // Add merged_at timestamp if task was just merged
      const existing = await this.models.tasks.findById(task.id);
      if (existing.status !== 'merged' && task.state === 'merged') {
        dbFormat.merged_at = now;
      }
      
      await this.models.tasks.update(task.id, dbFormat);
    } else {
      dbFormat.created_at = now;
      dbFormat.updated_at = now;
      await this.models.tasks.create(dbFormat);
    }
    
    return task;
  }
  
  /**
   * Delete a task
   */
  async delete(id) {
    const task = await this.findById(id);
    
    // Check business rule
    if (!task.canDelete()) {
      throw new ValidationError('state', 'Task cannot be deleted - has uncommitted changes');
    }
    
    // Delete associated terminal sessions first
    const sessions = await this.models.terminalSessions?.findByTaskId?.(id);
    if (sessions) {
      for (const session of sessions) {
        await this.models.terminalSessions.delete(session.id);
      }
    }
    
    // Delete the task
    await this.models.tasks.delete(id);
    
    return task;
  }
  
  /**
   * Check if a task exists
   */
  async exists(id) {
    const data = await this.models.tasks.findById(id);
    return data !== null;
  }
  
  /**
   * Update git status for a task
   */
  async updateGitStatus(id, gitStatus) {
    const task = await this.findById(id);
    
    // Update domain object with git status
    task.hasUncommittedChanges = gitStatus.hasUncommittedChanges || false;
    task.hasConflicts = gitStatus.hasConflicts || false;
    task.aheadCount = gitStatus.ahead || 0;
    task.behindCount = gitStatus.behind || 0;
    
    return await this.save(task);
  }
  
  /**
   * Find tasks by state
   */
  async findByState(state, projectId = null) {
    const tasks = projectId 
      ? await this.findByProject(projectId)
      : await this.findAll();
    
    return tasks.filter(task => task.state === state);
  }
  
  /**
   * Archive completed tasks older than days
   */
  async archiveOldMergedTasks(days = 30) {
    const tasks = await this.findByState('merged');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const tasksToArchive = [];
    for (const task of tasks) {
      const dbTask = await this.models.tasks.findById(task.id);
      if (dbTask.merged_at && new Date(dbTask.merged_at) < cutoffDate) {
        task.archive();
        await this.save(task);
        tasksToArchive.push(task);
      }
    }
    
    return tasksToArchive;
  }
}