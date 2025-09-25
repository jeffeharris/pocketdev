import { Project, NotFoundError } from '../../shared/domain/index.js';

/**
 * ProjectRepository - Handles Project domain object persistence
 * This is a lightweight repository that converts between domain objects and database
 */
export class ProjectRepository {
  constructor(models) {
    this.models = models;
  }
  
  /**
   * Find a project by ID and return domain object
   */
  async findById(id) {
    const data = await this.models.projects.findById(id);
    if (!data) {
      throw new NotFoundError('Project', id);
    }
    
    return Project.fromDatabase(data);
  }
  
  /**
   * Find all projects and return domain objects
   */
  async findAll() {
    const rows = await this.models.projects.findAll();
    return rows.map(row => Project.fromDatabase(row));
  }
  
  /**
   * Save a project domain object to database
   */
  async save(project) {
    const dbFormat = project.toDatabaseFormat();
    
    // Add timestamps
    const now = new Date().toISOString();
    if (await this.exists(project.id)) {
      dbFormat.updated_at = now;
      await this.models.projects.update(project.id, dbFormat);
    } else {
      dbFormat.created_at = now;
      dbFormat.updated_at = now;
      await this.models.projects.create(dbFormat);
    }
    
    return project;
  }
  
  /**
   * Delete a project
   */
  async delete(id) {
    const project = await this.findById(id);
    
    // Check business rule
    if (!project.canDelete()) {
      throw new ValidationError('state', 'Project cannot be deleted in current state');
    }
    
    // Delete associated tasks first (maintaining referential integrity)
    const tasks = await this.models.tasks.findByProjectId(id);
    for (const task of tasks) {
      await this.models.tasks.delete(task.id);
    }
    
    // Delete the project
    await this.models.projects.delete(id);
    
    return project;
  }
  
  /**
   * Check if a project exists
   */
  async exists(id) {
    const data = await this.models.projects.findById(id);
    return data !== null;
  }
  
  /**
   * Find projects matching criteria
   */
  async findWhere(criteria) {
    // This would need to be implemented in the model layer
    // For now, using findAll and filtering in memory
    const all = await this.findAll();
    
    return all.filter(project => {
      if (criteria.name && !project.name.includes(criteria.name)) {
        return false;
      }
      if (criteria.baseBranch && project.baseBranch !== criteria.baseBranch) {
        return false;
      }
      return true;
    });
  }
}