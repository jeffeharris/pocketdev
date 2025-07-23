#!/usr/bin/env node

/**
 * Simple cleanup script to remove old terminal sessions
 */

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use the same database setup as the models
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/pocketdev.db');
console.log('Using database:', dbPath);

// Import models to use existing database connection
async function cleanup() {
  try {
    // Dynamic import to handle ES modules
    const { default: Database } = await import('better-sqlite3');
    const db = new Database(dbPath);
    
    // Count old sessions first
    const countResult = db.prepare(`
      SELECT COUNT(*) as count
      FROM terminal_sessions
      WHERE session_id LIKE 'task-%-[0-9]%' 
         OR session_id LIKE 'temp-%-[0-9]%'
    `).get();
    
    console.log(`Found ${countResult.count} old sessions to clean up`);
    
    if (countResult.count === 0) {
      console.log('No old sessions found!');
      return;
    }
    
    // Get summary by task
    const summary = db.prepare(`
      SELECT task_id, COUNT(*) as count
      FROM terminal_sessions
      WHERE session_id LIKE 'task-%-[0-9]%' 
         OR session_id LIKE 'temp-%-[0-9]%'
      GROUP BY task_id
      ORDER BY count DESC
    `).all();
    
    console.log('\nSessions by task:');
    summary.forEach(row => {
      console.log(`  Task ${row.task_id}: ${row.count} sessions`);
    });
    
    // Delete old sessions
    const deleteResult = db.prepare(`
      DELETE FROM terminal_sessions
      WHERE session_id LIKE 'task-%-[0-9]%' 
         OR session_id LIKE 'temp-%-[0-9]%'
    `).run();
    
    console.log(`\nDeleted ${deleteResult.changes} old sessions from database`);
    
    // Show what's left
    const remaining = db.prepare(`
      SELECT COUNT(*) as count, COUNT(DISTINCT task_id) as tasks
      FROM terminal_sessions
      WHERE is_active = 1
    `).get();
    
    console.log(`\nRemaining active sessions: ${remaining.count} across ${remaining.tasks} tasks`);
    
    db.close();
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

cleanup();