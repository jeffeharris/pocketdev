/**
 * ProjectModel - Pure Single-Table Model
 * 
 * Only queries the projects table. No cross-table joins.
 * Task counting and other aggregations moved to ProjectService.
 */
import BaseModel from './base-model.js';
import { v4 as uuidv4 } from 'uuid';

class ProjectModel extends BaseModel {
  constructor(db) {
    super(db, 'projects');
    this.jsonFields = ['metadata'];
  }

  /**
   * Create a new project
   * @param {Object} projectData
   * @returns {Promise<Object>} The created project
   */
  async create(projectData) {
    const project = {
      id: projectData.id || uuidv4(),
      name: projectData.name,
      repo_url: projectData.repo_url,
      base_branch: projectData.base_branch || 'main',
      local_path: projectData.local_path || null,
      is_archived: projectData.is_archived || 0,
      metadata: projectData.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_accessed: new Date().toISOString()
    };

    return super.create(project);
  }

  /**
   * Find all active projects
   * @returns {Promise<Array>}
   */
  async findActive() {
    return this.findAll({ is_archived: 0 });
  }

  /**
   * Find all archived projects
   * @returns {Promise<Array>}
   */
  async findArchived() {
    return this.findAll({ is_archived: 1 });
  }

  /**
   * Find project by repository URL
   * @param {string} repoUrl
   * @returns {Promise<Object|null>}
   */
  async findByRepoUrl(repoUrl) {
    return this.findOne({ repo_url: repoUrl });
  }

  /**
   * Update last accessed timestamp
   * @param {string} id
   * @returns {Promise<void>}
   */
  async updateLastAccessed(id) {
    await this.db.run(
      `UPDATE ${this.tableName} SET last_accessed = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
  }

  /**
   * Archive a project
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
   * Unarchive a project
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
   * Search projects by name
   * @param {string} searchTerm
   * @returns {Promise<Array>}
   */
  async search(searchTerm) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE name LIKE ? AND is_archived = 0
      ORDER BY last_accessed DESC
    `;
    
    const results = await this.db.all(query, [`%${searchTerm}%`]);
    return this.parseJsonFieldsMany(results);
  }

  /**
   * Get recently accessed projects
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async findRecent(limit = 10) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE is_archived = 0
      ORDER BY last_accessed DESC
      LIMIT ?
    `;
    
    const results = await this.db.all(query, [limit]);
    return this.parseJsonFieldsMany(results);
  }

  /**
   * Update project metadata
   * @param {string} id
   * @param {Object} metadata
   * @returns {Promise<Object|null>}
   */
  async updateMetadata(id, metadata) {
    const project = await this.findById(id);
    if (!project) return null;

    const updatedMetadata = {
      ...(project.metadata || {}),
      ...metadata
    };

    return this.update(id, { 
      metadata: updatedMetadata,
      updated_at: new Date().toISOString()
    });
  }

  /**
   * Count active projects
   * @returns {Promise<number>}
   */
  async countActive() {
    return this.count({ is_archived: 0 });
  }

  /**
   * Count archived projects
   * @returns {Promise<number>}
   */
  async countArchived() {
    return this.count({ is_archived: 1 });
  }
}

export default ProjectModel;