#!/usr/bin/env node

/**
 * Script to clean up orphaned terminal sessions
 * Run this to remove terminals that exist in Shelltender but not in the database
 */

import fetch from 'node-fetch';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHELLTENDER_URL = process.env.SHELLTENDER_API_URL || 'http://localhost:8080';
const DB_PATH = path.join(__dirname, 'backend', 'data', 'pocketdev.db');

async function main() {
  console.log('🧹 Cleaning up orphaned terminal sessions...\n');

  // Open database connection
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  try {
    // 1. Get all active sessions from database
    const dbSessions = await db.all(`
      SELECT id, shelltender_session_id, task_id, tab_name
      FROM terminal_sessions
      WHERE is_active = 1
    `);
    console.log(`📊 Found ${dbSessions.length} active sessions in database`);

    // 2. Get all sessions from Shelltender
    let shelltenderSessions = [];
    try {
      const response = await fetch(`${SHELLTENDER_URL}/api/sessions`);
      if (response.ok) {
        shelltenderSessions = await response.json();
        console.log(`🖥️  Found ${shelltenderSessions.length} sessions in Shelltender`);
      } else {
        console.error('❌ Failed to fetch Shelltender sessions:', response.statusText);
      }
    } catch (error) {
      console.error('❌ Error connecting to Shelltender:', error.message);
      console.log('   Make sure Shelltender is running on port 8080');
    }

    // 3. Find orphaned Shelltender sessions (exist in Shelltender but not in DB)
    const dbSessionIds = new Set(dbSessions.map(s => s.shelltender_session_id).filter(Boolean));
    const orphanedSessions = shelltenderSessions.filter(
      session => session.id.startsWith('task-') && !dbSessionIds.has(session.id)
    );

    if (orphanedSessions.length === 0) {
      console.log('\n✅ No orphaned sessions found!');
    } else {
      console.log(`\n🔍 Found ${orphanedSessions.length} orphaned sessions:`);
      
      for (const session of orphanedSessions) {
        console.log(`   - ${session.id} (status: ${session.status})`);
        
        // Terminate the orphaned session
        try {
          const deleteResponse = await fetch(`${SHELLTENDER_URL}/api/sessions/${session.id}`, {
            method: 'DELETE'
          });
          
          if (deleteResponse.ok) {
            console.log(`     ✅ Terminated successfully`);
          } else {
            console.log(`     ⚠️  Failed to terminate: ${deleteResponse.statusText}`);
          }
        } catch (error) {
          console.log(`     ❌ Error terminating: ${error.message}`);
        }
      }
    }

    // 4. Find database sessions without Shelltender sessions (mark as inactive)
    const shelltenderSessionIds = new Set(shelltenderSessions.map(s => s.id));
    const deadSessions = dbSessions.filter(
      session => session.shelltender_session_id && !shelltenderSessionIds.has(session.shelltender_session_id)
    );

    if (deadSessions.length > 0) {
      console.log(`\n🪦 Found ${deadSessions.length} dead sessions in database:`);
      
      for (const session of deadSessions) {
        console.log(`   - ${session.tab_name} (ID: ${session.id})`);
        
        // Mark as inactive in database
        await db.run(
          'UPDATE terminal_sessions SET is_active = 0 WHERE id = ?',
          [session.id]
        );
        console.log(`     ✅ Marked as inactive`);
      }
    }

    console.log('\n✨ Cleanup complete!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await db.close();
  }
}

// Run the cleanup
main().catch(console.error);