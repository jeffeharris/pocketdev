const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fs = require('fs').promises;
const path = require('path');

class Database {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, '../../data/pocketdev.db');
  }

  async initialize() {
    // Ensure data directory exists
    const dataDir = path.dirname(this.dbPath);
    await fs.mkdir(dataDir, { recursive: true });

    // Open database connection
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });

    // Enable foreign keys
    await this.db.run('PRAGMA foreign_keys = ON');

    // Run schema
    const schema = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
    await this.db.exec(schema);

    console.log('Database initialized at:', this.dbPath);
  }

  async close() {
    if (this.db) {
      await this.db.close();
    }
  }

  // Helper methods
  async get(sql, params = []) {
    return this.db.get(sql, params);
  }

  async all(sql, params = []) {
    return this.db.all(sql, params);
  }

  async run(sql, params = []) {
    return this.db.run(sql, params);
  }

  async exec(sql) {
    return this.db.exec(sql);
  }

  // Transaction helper
  async transaction(callback) {
    await this.db.run('BEGIN TRANSACTION');
    try {
      const result = await callback(this);
      await this.db.run('COMMIT');
      return result;
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }
}

// Singleton instance
let instance = null;

module.exports = {
  async getDatabase() {
    if (!instance) {
      instance = new Database();
      await instance.initialize();
    }
    return instance;
  },

  async closeDatabase() {
    if (instance) {
      await instance.close();
      instance = null;
    }
  }
};