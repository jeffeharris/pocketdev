import crypto from 'crypto';

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
        COUNT(DISTINCT CASE WHEN t.status = 'active' THEN t.id END) as active_task_count
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id AND t.is_archived = 0
      ${where}
      GROUP BY p.id
      ORDER BY p.last_accessed DESC
    `);

    return projects.map(p => {
      if (p.metadata) {
        try {
          p.metadata = JSON.parse(p.metadata);
        } catch (e) {
          p.metadata = {};
        }
      }
      return p;
    });
  }

  async findByRepoUrl(repoUrl) {
    return this.db.get('SELECT * FROM projects WHERE repo_url = ? AND is_archived = 0', [repoUrl]);
  }

  async update(id, data) {
    const updates = [];
    const values = [];
    
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.baseBranch !== undefined || data.base_branch !== undefined) {
      updates.push('base_branch = ?');
      values.push(data.baseBranch || data.base_branch);
    }
    if (data.metadata !== undefined) {
      updates.push('metadata = ?');
      values.push(typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata));
    }
    
    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      
      await this.db.run(`
        UPDATE projects 
        SET ${updates.join(', ')}
        WHERE id = ?
      `, values);
    }
    
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
      SET is_archived = 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [id]);
  }

  async delete(id) {
    // This will cascade delete tasks and sessions
    await this.db.run('DELETE FROM projects WHERE id = ?', [id]);
  }
}

export default ProjectModel;