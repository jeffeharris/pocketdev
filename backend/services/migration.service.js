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
   * Run all pending migrations
   * @returns {Promise<{success: boolean, migrations: Array}>}
   */
  async runPendingMigrations() {
    console.log('[MigrationService] Checking for pending migrations...');
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
    const migrations = [
      { name: 'merge_tracking', table: 'tasks', column: 'merge_commit_sha' },
      { name: 'task_lifecycle', table: 'tasks', column: 'task_chain_id' },
      { name: 'multi_terminal_sessions', table: 'terminal_sessions', column: 'tab_name' },
      { name: 'split_view_layouts', table: 'tasks', column: 'split_layout' }
    ];

    const statuses = [];
    
    for (const migration of migrations) {
      try {
        const result = await this.db.get(
          `SELECT COUNT(*) as count FROM pragma_table_info(?) WHERE name = ?`,
          [migration.table, migration.column]
        );
        
        statuses.push({
          name: migration.name,
          applied: result.count > 0,
          table: migration.table,
          column: migration.column
        });
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
      // If migration has a custom check SQL, use that
      if (migration.checkSql) {
        const result = await this.db.get(migration.checkSql);
        // If the query returns a row, migration is needed
        return result !== undefined;
      }
      
      // Otherwise use the standard column check
      const result = await this.db.get(
        `SELECT COUNT(*) as count FROM pragma_table_info('${migration.checkTable}') 
         WHERE name='${migration.checkColumn}'`
      );
      return result.count === 0;
    } catch (error) {
      // Table might not exist yet
      return true;
    }
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
  }
}