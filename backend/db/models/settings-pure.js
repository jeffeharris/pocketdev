/**
 * SettingsModel - Pure Single-Table Model
 * 
 * Only queries the settings table.
 * Simple key-value store for application settings.
 */
import BaseModel from './base-model.js';

class SettingsModel extends BaseModel {
  constructor(db) {
    super(db, 'settings');
    this.jsonFields = []; // Values are stored as text, parsed at application layer
  }

  /**
   * Get a setting by key
   * @param {string} key
   * @returns {Promise<string|null>}
   */
  async get(key) {
    const record = await this.db.get(
      `SELECT value FROM ${this.tableName} WHERE key = ?`,
      [key]
    );
    return record ? record.value : null;
  }

  /**
   * Get multiple settings by keys
   * @param {Array<string>} keys
   * @returns {Promise<Object>}
   */
  async getMultiple(keys) {
    const placeholders = keys.map(() => '?').join(', ');
    const query = `
      SELECT key, value FROM ${this.tableName}
      WHERE key IN (${placeholders})
    `;
    
    const records = await this.db.all(query, keys);
    
    // Convert to object
    const settings = {};
    for (const record of records) {
      settings[record.key] = record.value;
    }
    
    return settings;
  }

  /**
   * Set a setting value
   * @param {string} key
   * @param {string} value
   * @returns {Promise<void>}
   */
  async set(key, value) {
    const query = `
      INSERT OR REPLACE INTO ${this.tableName} (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `;
    
    await this.db.run(query, [key, String(value)]);
  }

  /**
   * Set multiple settings
   * @param {Object} settings - Key-value pairs
   * @returns {Promise<void>}
   */
  async setMultiple(settings) {
    const query = `
      INSERT OR REPLACE INTO ${this.tableName} (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `;
    
    const stmt = await this.db.prepare(query);
    
    for (const [key, value] of Object.entries(settings)) {
      await stmt.run(key, String(value));
    }
    
    await stmt.finalize();
  }

  /**
   * Delete a setting
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async deleteByKey(key) {
    const result = await this.db.run(
      `DELETE FROM ${this.tableName} WHERE key = ?`,
      [key]
    );
    return result.changes > 0;
  }

  /**
   * Get all settings
   * @returns {Promise<Object>}
   */
  async getAll() {
    const records = await this.db.all(
      `SELECT key, value FROM ${this.tableName} ORDER BY key`
    );
    
    const settings = {};
    for (const record of records) {
      settings[record.key] = record.value;
    }
    
    return settings;
  }

  /**
   * Check if a setting exists
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async has(key) {
    const record = await this.db.get(
      `SELECT 1 FROM ${this.tableName} WHERE key = ? LIMIT 1`,
      [key]
    );
    return !!record;
  }

  /**
   * Get settings matching a pattern
   * @param {string} pattern - SQL LIKE pattern (e.g., 'feature_%')
   * @returns {Promise<Object>}
   */
  async getByPattern(pattern) {
    const records = await this.db.all(
      `SELECT key, value FROM ${this.tableName} WHERE key LIKE ? ORDER BY key`,
      [pattern]
    );
    
    const settings = {};
    for (const record of records) {
      settings[record.key] = record.value;
    }
    
    return settings;
  }

  /**
   * Clear all settings matching a pattern
   * @param {string} pattern - SQL LIKE pattern
   * @returns {Promise<number>} Number of deleted settings
   */
  async clearByPattern(pattern) {
    const result = await this.db.run(
      `DELETE FROM ${this.tableName} WHERE key LIKE ?`,
      [pattern]
    );
    return result.changes;
  }

  /**
   * Get JSON value (parsed)
   * @param {string} key
   * @returns {Promise<any>}
   */
  async getJson(key) {
    const value = await this.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value);
    } catch (e) {
      console.warn(`Failed to parse JSON setting ${key}:`, e.message);
      return null;
    }
  }

  /**
   * Set JSON value (stringified)
   * @param {string} key
   * @param {any} value
   * @returns {Promise<void>}
   */
  async setJson(key, value) {
    await this.set(key, JSON.stringify(value));
  }

  /**
   * Get numeric value
   * @param {string} key
   * @param {number} defaultValue
   * @returns {Promise<number>}
   */
  async getNumber(key, defaultValue = 0) {
    const value = await this.get(key);
    if (!value) return defaultValue;
    
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * Get boolean value
   * @param {string} key
   * @param {boolean} defaultValue
   * @returns {Promise<boolean>}
   */
  async getBoolean(key, defaultValue = false) {
    const value = await this.get(key);
    if (!value) return defaultValue;
    
    return value === 'true' || value === '1';
  }

  /**
   * Toggle a boolean setting
   * @param {string} key
   * @returns {Promise<boolean>} New value
   */
  async toggle(key) {
    const current = await this.getBoolean(key, false);
    const newValue = !current;
    await this.set(key, String(newValue));
    return newValue;
  }

  /**
   * Get settings with metadata (including updated_at)
   * @returns {Promise<Array>}
   */
  async getAllWithMetadata() {
    return this.db.all(
      `SELECT key, value, updated_at FROM ${this.tableName} ORDER BY key`
    );
  }
}

export default SettingsModel;