#!/usr/bin/env node

/**
 * Cleanup script to remove old terminal sessions with timestamp-based IDs
 * and their corresponding Shelltender sessions
 */

import Database from 'better-sqlite3';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHELLTENDER_URL = process.env.SHELLTENDER_API_URL || 'http://shelltender:8080';
const DB_PATH = path.join(__dirname, '../data/pocketdev.db');

async function deleteShelltenderSession(sessionId) {
  try {
    const response = await fetch(`${SHELLTENDER_URL}/api/sessions/${sessionId}`, {
      method: 'DELETE'
    });
    return response.ok;
  } catch (error) {
    console.error(`Failed to delete Shelltender session ${sessionId}:`, error.message);
    return false;
  }
}

async function cleanup() {
  console.log('Starting cleanup of old terminal sessions...\n');
  
  const db = new Database(DB_PATH);
  
  try {
    // Find all sessions with timestamp-based IDs (old format)
    // Old format: task-{taskId}-{timestamp} or temp-{taskId}-{timestamp}
    const oldSessions = db.prepare(`
      SELECT id, task_id, session_id, shelltender_session_id, tab_name, tab_order
      FROM terminal_sessions
      WHERE session_id LIKE 'task-%-[0-9]%' 
         OR session_id LIKE 'temp-%-[0-9]%'
      ORDER BY task_id, tab_order
    `).all();
    
    console.log(`Found ${oldSessions.length} old sessions to clean up\n`);
    
    if (oldSessions.length === 0) {
      console.log('No old sessions found. Database is clean!');
      return;
    }
    
    // Group by task for summary
    const sessionsByTask = {};
    for (const session of oldSessions) {
      if (!sessionsByTask[session.task_id]) {
        sessionsByTask[session.task_id] = [];
      }
      sessionsByTask[session.task_id].push(session);
    }
    
    // Show summary
    console.log('Sessions to delete by task:');
    for (const [taskId, sessions] of Object.entries(sessionsByTask)) {
      console.log(`  Task ${taskId}: ${sessions.length} sessions`);
    }
    console.log();
    
    // Ask for confirmation
    console.log('This will:');
    console.log('1. Delete these terminal sessions from the database');
    console.log('2. Terminate their Shelltender sessions (if they exist)');
    console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\nStarting deletion...\n');
    
    let deletedDb = 0;
    let deletedShelltender = 0;
    let failedShelltender = 0;
    
    // Delete in batches by task
    for (const [taskId, sessions] of Object.entries(sessionsByTask)) {
      console.log(`Processing task ${taskId}...`);
      
      for (const session of sessions) {
        // Try to delete Shelltender session first
        const shelltenderId = session.shelltender_session_id || session.session_id;
        if (shelltenderId) {
          const deleted = await deleteShelltenderSession(shelltenderId);
          if (deleted) {
            deletedShelltender++;
            process.stdout.write('.');
          } else {
            failedShelltender++;
            process.stdout.write('x');
          }
        }
        
        // Delete from database
        db.prepare('DELETE FROM terminal_sessions WHERE id = ?').run(session.id);
        deletedDb++;
      }
      console.log(' Done');
    }
    
    console.log('\nCleanup complete!');
    console.log(`- Deleted ${deletedDb} sessions from database`);
    console.log(`- Terminated ${deletedShelltender} Shelltender sessions`);
    if (failedShelltender > 0) {
      console.log(`- Failed to terminate ${failedShelltender} Shelltender sessions (may already be gone)`);
    }
    
    // Show remaining sessions
    const remaining = db.prepare(`
      SELECT COUNT(*) as count, COUNT(DISTINCT task_id) as tasks
      FROM terminal_sessions
      WHERE is_active = 1
    `).get();
    
    console.log(`\nRemaining active sessions: ${remaining.count} across ${remaining.tasks} tasks`);
    
  } finally {
    db.close();
  }
}

// Run cleanup
cleanup().catch(console.error);