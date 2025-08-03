import fetch from 'node-fetch';
import { initDB } from '../db/index.js';
import Models from '../db/models/index.js';

async function checkOrphanedSessions() {
  const db = await initDB();
  const models = new Models(db);
  
  console.log('🔍 Checking for orphaned terminal sessions...\n');
  
  try {
    // Get active sessions from database
    const dbSessions = await models.sessions.findAll({ isActive: true });
    console.log(`📊 Database has ${dbSessions.length} active sessions`);
    
    // Get all sessions from Shelltender
    const response = await fetch('http://shelltender:8080/api/sessions');
    const shelltenderSessions = await response.json();
    console.log(`🖥️  Shelltender has ${shelltenderSessions.length} sessions`);
    
    // Create sets for comparison
    const dbSessionIds = new Set(dbSessions.map(s => s.shelltender_session_id).filter(Boolean));
    const shelltenderIds = new Set(shelltenderSessions.map(s => s.id));
    
    // Find orphaned sessions (in Shelltender but not in DB)
    const orphaned = shelltenderSessions.filter(s => !dbSessionIds.has(s.id));
    console.log(`\n❗ Found ${orphaned.length} orphaned sessions in Shelltender`);
    
    if (orphaned.length > 0) {
      console.log('\nOrphaned sessions:');
      orphaned.forEach(s => {
        console.log(`  - ${s.id} (status: ${s.status})`);
      });
      
      console.log('\n🗑️  To clean these up, you can:');
      console.log('  1. Restart the backend container (docker-compose restart backend)');
      console.log('  2. Or manually terminate each session via Shelltender API');
    }
    
    // Find dead sessions (in DB but not in Shelltender)
    const dead = dbSessions.filter(s => s.shelltender_session_id && !shelltenderIds.has(s.shelltender_session_id));
    console.log(`\n💀 Found ${dead.length} dead sessions in database`);
    
    if (dead.length > 0) {
      console.log('\nDead sessions:');
      dead.forEach(s => {
        console.log(`  - ${s.tab_name} (ID: ${s.id})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

checkOrphanedSessions().catch(console.error);