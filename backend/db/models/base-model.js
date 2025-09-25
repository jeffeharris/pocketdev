/**
 * BaseModel - Deep Module for Database Models
 * 
 * Provides common functionality for all database models while ensuring
 * each model only queries its own table (single responsibility).
 * 
 * Features:
 * - JSON field parsing with error handling
 * - Common CRUD operations
 * - Timestamp management
 * - Query building helpers
 */
class BaseModel {
  constructor(db, tableName) {
    if (!db) throw new Error('Database connection required');
    if (!tableName) throw new Error('Table name required');
    
    this.db = db;
    this.tableName = tableName;
    this.jsonFields = []; // Override in subclasses
  }

  /**
   * Parse JSON fields in a record
   * @protected
   */
  parseJsonFields(record) {
    if (!record) return record;
    
    const parsed = { ...record };
    
    for (const field of this.jsonFields) {
      if (parsed[field] && typeof parsed[field] === 'string') {
        try {
          parsed[field] = JSON.parse(parsed[field]);
        } catch (e) {
          console.warn(`Failed to parse JSON field ${field}:`, e.message);
          parsed[field] = null;
        }
      }
    }
    
    return parsed;
  }

  /**
   * Parse JSON fields for multiple records
   * @protected
   */
  parseJsonFieldsMany(records) {
    return records.map(record => this.parseJsonFields(record));
  }

  /**
   * Stringify JSON fields before saving
   * @protected
   */
  stringifyJsonFields(data) {
    const stringified = { ...data };
    
    for (const field of this.jsonFields) {
      if (field in stringified && stringified[field] !== null) {
        if (typeof stringified[field] !== 'string') {
          stringified[field] = JSON.stringify(stringified[field]);
        }
      }
    }
    
    return stringified;
  }

  /**
   * Find a single record by ID
   * @param {string} id - Record ID
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const record = await this.db.get(
      `SELECT * FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    return this.parseJsonFields(record);
  }

  /**
   * Find all records (with optional conditions)
   * @param {Object} conditions - Key-value pairs for WHERE clause
   * @returns {Promise<Array>}
   */
  async findAll(conditions = {}) {
    let query = `SELECT * FROM ${this.tableName}`;
    const params = [];
    
    const conditionClauses = Object.entries(conditions).map(([key, value]) => {
      params.push(value);
      return `${key} = ?`;
    });
    
    if (conditionClauses.length > 0) {
      query += ` WHERE ${conditionClauses.join(' AND ')}`;
    }
    
    const records = await this.db.all(query, params);
    return this.parseJsonFieldsMany(records);
  }

  /**
   * Find a single record matching conditions
   * @param {Object} conditions - Key-value pairs for WHERE clause
   * @returns {Promise<Object|null>}
   */
  async findOne(conditions) {
    const records = await this.findAll(conditions);
    return records[0] || null;
  }

  /**
   * Create a new record
   * @param {Object} data - Record data
   * @returns {Promise<Object>} The created record
   */
  async create(data) {
    const prepared = this.stringifyJsonFields(data);
    const fields = Object.keys(prepared);
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map(field => prepared[field]);
    
    const query = `
      INSERT INTO ${this.tableName} (${fields.join(', ')})
      VALUES (${placeholders})
    `;
    
    const result = await this.db.run(query, values);
    
    // Return the created record
    if (data.id) {
      return this.findById(data.id);
    } else if (result.lastID) {
      return this.findById(result.lastID);
    }
    
    return prepared;
  }

  /**
   * Update a record by ID
   * @param {string} id - Record ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object|null>} The updated record
   */
  async update(id, updates) {
    const prepared = this.stringifyJsonFields(updates);
    const fields = Object.keys(prepared);
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = [...fields.map(field => prepared[field]), id];
    
    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE id = ?
    `;
    
    await this.db.run(query, values);
    return this.findById(id);
  }

  /**
   * Delete a record by ID
   * @param {string} id - Record ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    const result = await this.db.run(
      `DELETE FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    return result.changes > 0;
  }

  /**
   * Count records matching conditions
   * @param {Object} conditions - Key-value pairs for WHERE clause
   * @returns {Promise<number>}
   */
  async count(conditions = {}) {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params = [];
    
    const conditionClauses = Object.entries(conditions).map(([key, value]) => {
      params.push(value);
      return `${key} = ?`;
    });
    
    if (conditionClauses.length > 0) {
      query += ` WHERE ${conditionClauses.join(' AND ')}`;
    }
    
    const result = await this.db.get(query, params);
    return result.count;
  }

  /**
   * Check if a record exists
   * @param {string} id - Record ID
   * @returns {Promise<boolean>}
   */
  async exists(id) {
    const result = await this.db.get(
      `SELECT 1 FROM ${this.tableName} WHERE id = ? LIMIT 1`,
      [id]
    );
    return !!result;
  }

  /**
   * Execute raw SQL (use sparingly, only for complex queries)
   * @protected
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<any>}
   */
  async raw(query, params = []) {
    // This should only query the model's own table
    if (!query.includes(this.tableName)) {
      throw new Error(`Model can only query its own table: ${this.tableName}`);
    }
    
    if (query.trim().toUpperCase().startsWith('SELECT')) {
      const isMultiple = query.includes('SELECT *') || query.includes('SELECT COUNT');
      return isMultiple ? this.db.all(query, params) : this.db.get(query, params);
    }
    
    return this.db.run(query, params);
  }
}

export default BaseModel;