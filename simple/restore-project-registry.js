#!/usr/bin/env node

// Script to restore project registry from existing directories

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECTS_DIR = './projects';
const API_URL = 'http://localhost:3005/api/projects/restore';

async function scanProjects() {
  console.log('🔍 Scanning for existing projects...\n');
  
  const projects = new Map();
  const entries = fs.readdirSync(PROJECTS_DIR);
  
  for (const entry of entries) {
    const fullPath = path.join(PROJECTS_DIR, entry);
    const stat = fs.statSync(fullPath);
    
    if (!stat.isDirectory()) continue;
    
    // Check if it's a task worktree (contains -task-)
    if (entry.includes('-task-')) {
      // This is a task worktree, format: {projectId}-task-{taskId}
      const match = entry.match(/^(.+)-task-(.+)$/);
      if (match) {
        const [_, projectId, taskId] = match;
        
        if (!projects.has(projectId)) {
          console.log(`⚠️  Found orphaned task ${entry} (no parent project)`);
          continue;
        }
        
        const project = projects.get(projectId);
        
        // Try to get task name from git branch
        let taskName = 'Unknown Task';
        let branch = 'unknown';
        try {
          const gitHead = fs.readFileSync(path.join(fullPath, '.git', 'HEAD'), 'utf8').trim();
          if (gitHead.startsWith('ref: refs/heads/')) {
            branch = gitHead.replace('ref: refs/heads/', '');
            taskName = branch.replace(/[-_]/g, ' ');
          }
        } catch (e) {
          // Ignore
        }
        
        project.tasks.push({
          id: taskId,
          name: taskName,
          branch: branch,
          worktreePath: fullPath,
          createdAt: stat.birthtime
        });
      }
    } else {
      // This is a main project directory
      const projectId = entry;
      
      // Try to get project info from git
      let repoUrl = '';
      let projectName = entry;
      let baseBranch = 'main';
      
      try {
        // Get remote URL
        const gitConfig = fs.readFileSync(path.join(fullPath, '.git', 'config'), 'utf8');
        const urlMatch = gitConfig.match(/url = (.+)/);
        if (urlMatch) {
          repoUrl = urlMatch[1].trim();
          // Extract project name from URL
          const repoName = repoUrl.split('/').pop().replace('.git', '');
          projectName = repoName;
        }
        
        // Get current branch
        const gitHead = fs.readFileSync(path.join(fullPath, '.git', 'HEAD'), 'utf8').trim();
        if (gitHead.startsWith('ref: refs/heads/')) {
          baseBranch = gitHead.replace('ref: refs/heads/', '');
        }
      } catch (e) {
        console.log(`⚠️  Could not read git info for ${entry}`);
      }
      
      projects.set(projectId, {
        id: projectId,
        name: projectName,
        repoUrl: repoUrl,
        baseBranch: baseBranch,
        path: fullPath,
        createdAt: stat.birthtime,
        tasks: []
      });
      
      console.log(`✅ Found project: ${projectName} (${projectId})`);
    }
  }
  
  // Second pass to add tasks to projects
  for (const entry of entries) {
    if (entry.includes('-task-')) {
      const match = entry.match(/^(.+)-task-(.+)$/);
      if (match) {
        const [_, projectId, taskId] = match;
        if (projects.has(projectId)) {
          console.log(`  📌 Found task for ${projectId}: task-${taskId}`);
        }
      }
    }
  }
  
  return Array.from(projects.values());
}

async function restoreToAPI(projects) {
  console.log('\n📤 Sending to API...\n');
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projects })
    });
    
    if (!response.ok) {
      throw new Error(`API responded with ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ Successfully restored project registry!');
    console.log(`   - ${result.projectsRestored} projects`);
    console.log(`   - ${result.tasksRestored} tasks`);
  } catch (error) {
    console.error('❌ Failed to restore via API:', error.message);
    console.log('\n💾 Saving to file instead: ./restored-projects.json');
    fs.writeFileSync('./restored-projects.json', JSON.stringify(projects, null, 2));
    console.log('\n📝 You can manually import this file or update the API to support restoration.');
  }
}

// Main execution
async function main() {
  console.log('🔄 Project Registry Restoration\n');
  console.log('================================\n');
  
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error('❌ Projects directory not found!');
    process.exit(1);
  }
  
  const projects = await scanProjects();
  
  console.log(`\n📊 Summary:`);
  console.log(`   - Found ${projects.length} projects`);
  console.log(`   - Found ${projects.reduce((sum, p) => sum + p.tasks.length, 0)} tasks`);
  
  if (projects.length > 0) {
    await restoreToAPI(projects);
  } else {
    console.log('\n❌ No projects found to restore.');
  }
}

main().catch(console.error);