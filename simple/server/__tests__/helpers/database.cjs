const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fs = require('fs').promises;
const path = require('path');

async function createTestDatabase() {
  // Use in-memory database for tests
  const dbPath = ':memory:';
  
  // Open database
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  
  // Enable foreign keys
  await db.run('PRAGMA foreign_keys = ON');
  
  // Load schema
  const schemaPath = path.join(__dirname, '../../db/schema.sql');
  const schema = await fs.readFile(schemaPath, 'utf8');
  await db.exec(schema);
  
  return db;
}

async function clearDatabase(db) {
  // Clear all tables in reverse order of dependencies
  await db.run('DELETE FROM claude_sessions');
  await db.run('DELETE FROM tasks');
  await db.run('DELETE FROM projects');
  await db.run('DELETE FROM worktree_registry');
  await db.run('DELETE FROM git_credentials');
  await db.run('DELETE FROM settings');
}

module.exports = {
  createTestDatabase,
  clearDatabase
};