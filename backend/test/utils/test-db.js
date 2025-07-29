import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create an in-memory test database
 */
export async function createTestDatabase() {
  const db = await open({
    filename: ':memory:',
    driver: sqlite3.Database
  });

  // Read and execute the schema
  const schemaPath = path.join(__dirname, '../../db/schema.sql');
  const schema = await fs.readFile(schemaPath, 'utf-8');
  
  // Split schema by semicolons and execute each statement
  const statements = schema.split(';').filter(stmt => stmt.trim());
  for (const statement of statements) {
    await db.exec(statement);
  }

  // Apply migrations
  const migrationsDir = path.join(__dirname, '../../db/migrations');
  const migrationFiles = await fs.readdir(migrationsDir);
  
  for (const file of migrationFiles.sort()) {
    if (file.endsWith('.sql')) {
      const migrationPath = path.join(migrationsDir, file);
      const migration = await fs.readFile(migrationPath, 'utf-8');
      const migrationStatements = migration.split(';').filter(stmt => stmt.trim());
      
      for (const statement of migrationStatements) {
        try {
          await db.exec(statement);
        } catch (error) {
          console.error(`Error applying migration ${file}:`, error.message);
        }
      }
    }
  }

  return db;
}

/**
 * Seed test data
 */
export async function seedTestData(db) {
  // Create a test project
  const project = await db.run(
    `INSERT INTO projects (id, name, repo_url, local_path, base_branch, created_at) 
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    ['test-project-1', 'Test Project', 'https://github.com/test/repo', '/tmp/test-project', 'main']
  );

  // Create a test task
  const task = await db.run(
    `INSERT INTO tasks (id, project_id, name, branch, worktree_path, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    ['test-task-1', 'test-project-1', 'Test Task', 'feature/test', '/tmp/test-task', 'active']
  );

  return {
    projectId: 'test-project-1',
    taskId: 'test-task-1'
  };
}