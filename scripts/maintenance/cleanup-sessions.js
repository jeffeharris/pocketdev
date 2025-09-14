#!/usr/bin/env node

import fetch from 'node-fetch';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../data/pocketdev.db');
const db = new Database(dbPath);

const shelltenderUrl = process.env.SHELLTENDER_API_URL || 'http://localhost:8080';

async function cleanupSessions() {
  console.log('Starting session cleanup...');
  
  // Get sessions to delete (keep only 6 most recent per task)
  const sessionsToDelete = db.prepare(`
    WITH KeepSessions AS (
      SELECT id, task_id, tab_order, created_at
      FROM (
        SELECT id, task_id, tab_order, created_at,
               ROW_NUMBER() OVER (PARTITION BY task_id ORDER BY tab_order ASC) as rn
        FROM terminal_sessions
        WHERE is_active = 1
      )
      WHERE rn <= 6
    )
    SELECT ts.id, ts.shelltender_session_id, ts.task_id, ts.tab_name
    FROM terminal_sessions ts
    WHERE ts.is_active = 1 
      AND ts.id NOT IN (SELECT id FROM KeepSessions)
  `).all();
  
  console.log(`Found ${sessionsToDelete.length} sessions to delete`);
  
  let deletedFromShelltender = 0;
  let deletedFromDb = 0;
  
  // Delete from Shelltender first
  for (const session of sessionsToDelete) {
    if (session.shelltender_session_id) {
      try {
        const response = await fetch(`${shelltenderUrl}/api/sessions/${session.shelltender_session_id}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          console.log(`✓ Deleted Shelltender session: ${session.shelltender_session_id}`);
          deletedFromShelltender++;
        } else if (response.status === 404) {
          console.log(`- Session not found in Shelltender: ${session.shelltender_session_id}`);
        } else {
          console.log(`✗ Failed to delete Shelltender session: ${session.shelltender_session_id} (${response.status})`);
        }
      } catch (error) {
        console.error(`✗ Error deleting Shelltender session ${session.shelltender_session_id}:`, error.message);
      }
    }
  }
  
  // Delete from database
  const deleteStmt = db.prepare('DELETE FROM terminal_sessions WHERE id = ?');
  const deleteMany = db.transaction((sessions) => {
    for (const session of sessions) {
      deleteStmt.run(session.id);
      deletedFromDb++;
    }
  });
  
  deleteMany(sessionsToDelete);
  
  console.log('\nCleanup Summary:');
  console.log(`- Total sessions processed: ${sessionsToDelete.length}`);
  console.log(`- Deleted from Shelltender: ${deletedFromShelltender}`);
  console.log(`- Deleted from database: ${deletedFromDb}`);
  
  // Show current state
  const summary = db.prepare(`
    SELECT t.id, t.name, COUNT(ts.id) as terminal_count 
    FROM tasks t 
    LEFT JOIN terminal_sessions ts ON ts.task_id = t.id AND ts.is_active = 1 
    GROUP BY t.id 
    ORDER BY terminal_count DESC
    LIMIT 10
  `).all();
  
  console.log('\nCurrent terminal counts by task:');
  for (const task of summary) {
    console.log(`- ${task.name}: ${task.terminal_count} terminals`);
  }
  
  db.close();
}

cleanupSessions().catch(console.error);