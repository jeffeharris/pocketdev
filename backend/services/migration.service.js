/**
 * MigrationService - Deep Module for Database Migrations
 * 
 * Handles all database migration logic with a simple interface.
 * Hides the complexity of checking and running migrations.
 * 
 * Public API (2 methods):
 * - runPendingMigrations() - Run all pending migrations
 * - getMigrationStatus() - Get status of all migrations
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class MigrationService {
  constructor(db, config = {}) {
    this.db = db;
    this.migrationsDir = config.migrationsDir || path.join(__dirname, '../db/migrations');
    this.dbPath = config.dbPath || path.join(__dirname, '../pocketdev.db');
  }

  /**
   * Initialize migration tracking table
   */
  async _ensureMigrationsTable() {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT
      )
    `);
  }

  /**
   * Run all pending migrations
   * @returns {Promise<{success: boolean, migrations: Array}>}
   */
  async runPendingMigrations() {
    console.log('[MigrationService] Checking for pending migrations...');
    
    // Ensure migrations table exists
    await this._ensureMigrationsTable();
    console.log('[MigrationService] Migrations table ensured');
    
    const migrations = [
      {
        name: 'merge_tracking',
        file: 'add_merge_tracking.sql',
        checkTable: 'tasks',
        checkColumn: 'merge_commit_sha',
        description: 'Add merge tracking columns to tasks'
      },
      {
        name: 'task_lifecycle',
        file: '001_task_lifecycle.sql',
        checkTable: 'tasks',
        checkColumn: 'task_chain_id',
        description: 'Add task lifecycle tracking'
      },
      {
        name: 'multi_terminal_sessions',
        file: '003_multi_terminal_sessions.sql',
        checkTable: 'terminal_sessions',
        checkColumn: 'tab_name',
        description: 'Add multi-terminal session support'
      },
      {
        name: 'split_view_layouts',
        file: '004_split_view_layouts.sql',
        checkTable: 'tasks',
        checkColumn: 'split_layout',
        description: 'Add split view layout support'
      },
      {
        name: 'fix_tasks_primary_key',
        file: '005_fix_tasks_primary_key.sql',
        checkSql: "SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks' AND sql NOT LIKE '%PRIMARY KEY%'",
        description: 'Fix missing PRIMARY KEY on tasks table'
      }
    ];

    const results = [];
    
    for (const migration of migrations) {
      try {
        const needed = await this._isMigrationNeeded(migration);
        
        if (needed) {
          console.log(`Running ${migration.name} migration...`);
          await this._runMigration(migration);
          console.log(`${migration.name} migration completed`);
          results.push({ 
            name: migration.name, 
            status: 'completed',
            description: migration.description 
          });
        } else {
          results.push({ 
            name: migration.name, 
            status: 'already_applied',
            description: migration.description 
          });
        }
      } catch (error) {
        console.error(`${migration.name} migration failed:`, error);
        results.push({ 
          name: migration.name, 
          status: 'failed', 
          error: error.message,
          description: migration.description 
        });
      }
    }

    const success = !results.some(r => r.status === 'failed');
    return { success, migrations: results };
  }

  /**
   * Get the status of all migrations
   * @returns {Promise<Array>} Migration status list
   */
  async getMigrationStatus() {
    await this._ensureMigrationsTable();
    
    const allMigrations = [
      { name: 'merge_tracking', table: 'tasks', column: 'merge_commit_sha' },
      { name: 'task_lifecycle', table: 'tasks', column: 'task_chain_id' },
      { name: 'multi_terminal_sessions', table: 'terminal_sessions', column: 'tab_name' },
      { name: 'split_view_layouts', table: 'tasks', column: 'split_layout' },
      { name: 'fix_tasks_primary_key' }
    ];

    const statuses = [];
    
    for (const migration of allMigrations) {
      try {
        // Check if migration is in tracking table
        const tracked = await this.db.get(
          'SELECT name, applied_at FROM schema_migrations WHERE name = ?',
          [migration.name]
        );
        
        if (tracked) {
          statuses.push({
            name: migration.name,
            applied: true,
            applied_at: tracked.applied_at,
            source: 'tracked'
          });
        } else if (migration.table && migration.column) {
          // Fall back to schema check for backward compatibility
          const result = await this.db.get(
            `SELECT COUNT(*) as count FROM pragma_table_info(?) WHERE name = ?`,
            [migration.table, migration.column]
          );
          
          statuses.push({
            name: migration.name,
            applied: result.count > 0,
            source: 'schema_check',
            table: migration.table,
            column: migration.column
          });
        } else {
          statuses.push({
            name: migration.name,
            applied: false,
            source: 'not_found'
          });
        }
      } catch (error) {
        statuses.push({
          name: migration.name,
          applied: false,
          error: error.message
        });
      }
    }
    
    return statuses;
  }

  // Private methods (hidden complexity)
  
  async _isMigrationNeeded(migration) {
    try {
      // First check if migration is recorded as completed
      const completed = await this.db.get(
        'SELECT name FROM schema_migrations WHERE name = ?',
        [migration.name]
      );
      
      if (completed) {
        return false; // Migration already applied
      }
      
      // For backward compatibility, also check if the schema already exists
      // This helps with the transition to the new tracking system
      if (migration.checkSql) {
        const result = await this.db.get(migration.checkSql);
        // If the query returns a row, migration is needed
        return result !== undefined;
      } else if (migration.checkTable && migration.checkColumn) {
        const result = await this.db.get(
          `SELECT COUNT(*) as count FROM pragma_table_info('${migration.checkTable}') 
           WHERE name='${migration.checkColumn}'`
        );
        
        // If column exists but migration not tracked, mark it as applied
        if (result.count > 0) {
          await this._markMigrationAsApplied(migration);
          return false;
        }
      }
      
      return true; // Migration needed
    } catch (error) {
      // Table might not exist yet
      return true;
    }
  }

  async _markMigrationAsApplied(migration) {
    const checksum = migration.file || 'legacy';
    await this.db.run(
      'INSERT OR IGNORE INTO schema_migrations (name, checksum) VALUES (?, ?)',
      [migration.name, checksum]
    );
  }

  async _runMigration(migration) {
    // Try multiple potential paths for the migration file
    const potentialPaths = [
      path.join(this.migrationsDir, migration.file),
      path.join(path.dirname(this.dbPath), 'migrations', migration.file)
    ];
    
    let migrationSql = null;
    let usedPath = null;
    
    for (const migrationPath of potentialPaths) {
      try {
        migrationSql = await fs.readFile(migrationPath, 'utf8');
        usedPath = migrationPath;
        break;
      } catch (error) {
        // Try next path
        continue;
      }
    }
    
    if (!migrationSql) {
      throw new Error(`Migration file not found: ${migration.file}`);
    }
    
    console.log(`  Loading migration from: ${usedPath}`);
    await this.db.exec(migrationSql);
    
    // Mark migration as applied after successful execution
    await this._markMigrationAsApplied(migration);
  }
}