// Script to migrate existing tasks to use shelltender sessions
import { createTaskSession } from './shelltender-simple.js';
import { getDatabase } from './db/index.js';
import Models from './db/models/index.js';

async function migrateTasksToShelltender() {
  console.log('Migrating existing tasks to shelltender...');
  
  const db = await getDatabase();
  const models = new Models(db);
  
  // Get all active tasks
  const tasks = await db.all(`
    SELECT t.*, p.name as project_name 
    FROM tasks t 
    JOIN projects p ON t.project_id = p.id 
    WHERE t.status = 'active' 
    ORDER BY t.created_at DESC
  `);
  
  console.log(`Found ${tasks.length} active tasks to migrate`);
  
  for (const task of tasks) {
    try {
      console.log(`\nMigrating task ${task.id} (${task.name}) in project ${task.project_name}`);
      
      // Create shelltender session for this task
      const session = await createTaskSession(
        task.id,
        task.worktree_path,
        {
          projectId: task.project_id,
          projectName: task.project_name,
          taskName: task.name,
          branch: task.branch
        }
      );
      
      console.log(`✓ Created shelltender session: ${session.id}`);
      
      // Store the session ID in the database
      await models.sessions.create(task.id, {
        sessionId: session.id,
        isActive: true,
        model: 'shelltender',
        metadata: {
          type: 'terminal',
          provider: 'shelltender',
          taskName: task.name,
          branch: task.branch
        }
      });
      
      console.log(`✓ Stored session mapping in database`);
      
    } catch (error) {
      console.error(`✗ Failed to migrate task ${task.id}:`, error.message);
    }
  }
  
  console.log('\nMigration complete!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateTasksToShelltender()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

export { migrateTasksToShelltender };