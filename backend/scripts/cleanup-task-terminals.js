import { initDB } from '../db/index.js';
import Models from '../db/models/index.js';

async function cleanupTaskTerminals(taskId) {
  const db = await initDB();
  const models = new Models(db);
  
  console.log(`\n🧹 Cleaning up terminals for task ${taskId}...\n`);
  
  try {
    // Get all terminals for the task
    const terminals = await db.all(`
      SELECT id, shelltender_session_id, tab_name, is_active, created_at 
      FROM terminal_sessions 
      WHERE task_id = ? 
      ORDER BY created_at DESC
    `, taskId);
    
    console.log(`Found ${terminals.length} terminals:`);
    terminals.forEach(t => {
      console.log(`  - ${t.id}: ${t.tab_name} (active: ${t.is_active})`);
    });
    
    // Find duplicates among active terminals
    const activeTerminals = terminals.filter(t => t.is_active === 1);
    const seen = new Map();
    const toDelete = [];
    
    activeTerminals.forEach(t => {
      const existing = seen.get(t.tab_name);
      if (existing) {
        // Keep the newer one, delete the older
        const existingDate = new Date(existing.created_at);
        const currentDate = new Date(t.created_at);
        if (currentDate > existingDate) {
          toDelete.push(existing.id);
          seen.set(t.tab_name, t);
        } else {
          toDelete.push(t.id);
        }
      } else {
        seen.set(t.tab_name, t);
      }
    });
    
    if (toDelete.length > 0) {
      console.log(`\n❗ Found ${toDelete.length} duplicate terminals to delete:`, toDelete);
      
      for (const id of toDelete) {
        await db.run('DELETE FROM terminal_sessions WHERE id = ?', id);
      }
      
      console.log('✅ Duplicates deleted');
    } else {
      console.log('\n✅ No duplicates found');
    }
    
    // Show final state
    const remaining = await db.get(`
      SELECT COUNT(*) as count 
      FROM terminal_sessions 
      WHERE task_id = ? AND is_active = 1
    `, taskId);
    
    console.log(`\n📊 Final state: ${remaining.count} active terminals`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

// Get task ID from command line or use the one from the logs
const taskId = process.argv[2] || 'b0a4497b';
cleanupTaskTerminals(taskId).catch(console.error);