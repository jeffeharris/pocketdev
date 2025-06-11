const crypto = require('crypto');

class ProjectModel {
  constructor(db) {
    this.db = db;
  }

  generateId() {
    return crypto.randomBytes(4).toString('hex');
  }

  async create(data) {
    const id = data.id || this.generateId();
    const now = new Date().toISOString();
    
    const result = await this.db.run(`
      INSERT INTO projects (id, name, repo_url, base_branch, local_path, created_at, updated_at, last_accessed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, data.name, data.repoUrl || data.repo_url, data.baseBranch || data.base_branch || 'main', 
        data.localPath || data.local_path || null, now, now, now]);

    return this.findById(id);
  }

  async findById(id) {
    const project = await this.db.get(`
      SELECT p.*,
        COUNT(DISTINCT t.id) as task_count,
        COUNT(DISTINCT CASE WHEN t.status = 'active' THEN t.id END) as active_task_count
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id AND t.is_archived = 0
      WHERE p.id = ? AND p.is_archived = 0
      GROUP BY p.id
    `, [id]);

    if (project && project.metadata) {
      try {
        project.metadata = JSON.parse(project.metadata);
      } catch (e) {
        project.metadata = {};
      }
    }

    return project;
  }

  async findAll(includeArchived = false) {
    const where = includeArchived ? '' : 'WHERE p.is_archived = 0';
    
    const projects = await this.db.all(`
      SELECT p.*,
        COUNT(DISTINCT t.id) as task_count,
        COUNT(DISTINCT CASE WHEN t.status = 'active' THEN t.id END) as active_task_count,
        MAX(t.updated_at) as last_task_activity
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id AND t.is_archived = 0
      ${where}
      GROUP BY p.id
      ORDER BY p.last_accessed DESC, p.created_at DESC
    `);

    // Parse metadata
    for (const project of projects) {
      if (project.metadata) {
        try {
          project.metadata = JSON.parse(project.metadata);
        } catch (e) {
          project.metadata = {};
        }
      }
    }

    return projects;
  }

  async update(id, data) {
    const fields = [];
    const values = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.repoUrl !== undefined || data.repo_url !== undefined) {
      fields.push('repo_url = ?');
      values.push(data.repoUrl || data.repo_url);
    }
    if (data.baseBranch !== undefined || data.base_branch !== undefined) {
      fields.push('base_branch = ?');
      values.push(data.baseBranch || data.base_branch);
    }
    if (data.localPath !== undefined || data.local_path !== undefined) {
      fields.push('local_path = ?');
      values.push(data.localPath || data.local_path);
    }
    if (data.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(JSON.stringify(data.metadata));
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await this.db.run(`
      UPDATE projects 
      SET ${fields.join(', ')}
      WHERE id = ?
    `, values);

    return this.findById(id);
  }

  async updateLastAccessed(id) {
    await this.db.run(`
      UPDATE projects 
      SET last_accessed = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);
  }

  async archive(id) {
    await this.db.run(`
      UPDATE projects 
      SET is_archived = 1
      WHERE id = ?
    `, [id]);

    // Also archive all tasks
    await this.db.run(`
      UPDATE tasks 
      SET is_archived = 1
      WHERE project_id = ?
    `, [id]);
  }

  async delete(id) {
    // This will cascade delete tasks and sessions
    await this.db.run('DELETE FROM projects WHERE id = ?', [id]);
  }

  async exists(id) {
    const result = await this.db.get(
      'SELECT 1 FROM projects WHERE id = ? AND is_archived = 0',
      [id]
    );
    return !!result;
  }

  async findByRepoUrl(repoUrl) {
    return this.db.get(`
      SELECT * FROM projects 
      WHERE repo_url = ? AND is_archived = 0
      LIMIT 1
    `, [repoUrl]);
  }
}

module.exports = ProjectModel;