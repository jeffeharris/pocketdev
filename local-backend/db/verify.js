import { db } from './index.js';
import { engineerProfiles, projects, tasks } from './schema.js';

async function verify() {
  console.log('=== Database Verification ===\n');
  
  // Check engineer profiles
  const engineers = await db.select().from(engineerProfiles);
  console.log(`Engineer Profiles (${engineers.length}):`);
  engineers.forEach(eng => {
    console.log(`  - ${eng.name} (${eng.role}) - ID: ${eng.id.substring(0, 8)}...`);
  });
  
  // Check projects
  const projectList = await db.select().from(projects);
  console.log(`\nProjects (${projectList.length}):`);
  projectList.forEach(proj => {
    console.log(`  - ${proj.name} - ${proj.repositoryUrl}`);
  });
  
  // Check tasks
  const taskList = await db.select().from(tasks);
  console.log(`\nTasks (${taskList.length}):`);
  taskList.forEach(task => {
    console.log(`  - ${task.title} (${task.status})`);
  });
  
  console.log('\n=== Verification Complete ===');
  process.exit(0);
}

verify().catch(console.error);