#!/usr/bin/env node

// Check terminal sessions in database using Node.js SQLite

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function checkDatabase() {
  let db;
  
  try {
    // Find the actual database path
    const dbPath = process.env.DATABASE_PATH || join(process.env.HOME, '.pocketdev/data/pocketdev.db');
    console.log('Checking database at:', dbPath);
    
    // Open database connection
    db = await open({
      filename: dbPath,
      driver: sqlite3.verbose().Database
    });
    
    // Query terminal sessions
    console.log('\n=== Terminal Sessions in Database ===');
    const sessions = await db.all(`
      SELECT 
        id as db_session_id,
        task_id,
        session_id,
        shelltender_session_id,
        is_active,
        tab_name,
        tab_order,
        created_at,
        last_activity
      FROM terminal_sessions 
      ORDER BY created_at DESC 
      LIMIT 20
    `);
    
    if (sessions.length === 0) {
      console.log('No terminal sessions found');
    } else {
      console.log(`Found ${sessions.length} sessions:`);
      sessions.forEach(session => {
        console.log(`
  Session: ${session.db_session_id}
    Task ID: ${session.task_id}
    Shelltender ID: ${session.shelltender_session_id}
    Tab: ${session.tab_name} (order: ${session.tab_order})
    Active: ${session.is_active ? 'Yes' : 'No'}
    Created: ${new Date(session.created_at).toLocaleString()}
        `);
      });
    }
    
    // Count total sessions
    const count = await db.get('SELECT COUNT(*) as total FROM terminal_sessions');
    console.log(`\nTotal sessions in database: ${count.total}`);
    
    // Check for orphaned sessions
    console.log('\n=== Checking for Orphaned Sessions ===');
    const orphans = await db.all(`
      SELECT 
        s.id as session_id,
        s.task_id,
        s.tab_name,
        s.created_at
      FROM terminal_sessions s
      LEFT JOIN tasks t ON s.task_id = t.id
      WHERE t.id IS NULL
    `);
    
    if (orphans.length > 0) {
      console.log(`Found ${orphans.length} orphaned sessions:`);
      orphans.forEach(orphan => {
        console.log(`  - Session ${orphan.session_id} (Task ${orphan.task_id} - ${orphan.tab_name})`);
      });
    } else {
      console.log('No orphaned sessions found');
    }
    
    // Check sessions by task
    console.log('\n=== Sessions Grouped by Task ===');
    const taskSessions = await db.all(`
      SELECT 
        task_id,
        COUNT(*) as session_count,
        GROUP_CONCAT(tab_name, ', ') as tabs
      FROM terminal_sessions
      GROUP BY task_id
      ORDER BY task_id
    `);
    
    taskSessions.forEach(task => {
      console.log(`Task ${task.task_id}: ${task.session_count} sessions (${task.tabs})`);
    });
    
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

// Run the check
checkDatabase().catch(console.error);