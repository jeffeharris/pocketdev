/**
 * ProjectRepository - Handles all database operations for projects
 */
export class ProjectRepository {
  constructor(models) {
    this.models = models;
  }

  async create(projectData) {
    return await this.models.projects.create(projectData);
  }

  async findById(projectId) {
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      const error = new Error('Project not found');
      error.statusCode = 404;
      throw error;
    }
    return project;
  }

  async findByIdMinimal(projectId) {
    const project = await this.models.projects.findByIdMinimal(projectId);
    if (!project) {
      const error = new Error('Project not found');
      error.statusCode = 404;
      throw error;
    }
    return project;
  }

  async list(options = {}) {
    const { nameOnly = false } = options;
    return nameOnly 
      ? await this.models.projects.findAllMinimal()
      : await this.models.projects.findAll();
  }

  async update(projectId, updates) {
    return await this.models.projects.update(projectId, updates);
  }

  async delete(projectId) {
    const project = await this.findById(projectId);
    
    // Delete all associated tasks
    const tasks = await this.models.tasks.findByProjectId(projectId);
    for (const task of tasks) {
      await this.models.tasks.delete(task.id);
    }
    
    // Delete the project
    await this.models.projects.delete(projectId);
    
    return project;
  }

  async getWithTasks(projectId) {
    const project = await this.findById(projectId);
    const tasks = await this.models.tasks.findByProjectId(projectId);
    return { ...project, tasks };
  }

  async getProjectTasks(projectId) {
    return await this.models.tasks.findByProjectId(projectId);
  }
}