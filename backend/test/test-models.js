#!/usr/bin/env node

/**
 * Quick test script to verify our pure models work
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import Models from './db/models/index.js';

async function testModels() {
  console.log('Opening test database...');
  
  // Open in-memory database for testing
  const db = await open({
    filename: ':memory:',
    driver: sqlite3.Database
  });

  console.log('Creating schema...');
  
  // Create minimal schema for testing
  await db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      repo_url TEXT NOT NULL,
      base_branch TEXT DEFAULT 'main',
      local_path TEXT,
      is_archived BOOLEAN DEFAULT 0,
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      branch TEXT NOT NULL,
      worktree_path TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      is_archived BOOLEAN DEFAULT 0,
      has_uncommitted_changes BOOLEAN DEFAULT 0,
      last_commit_sha TEXT,
      merged_at TIMESTAMP,
      merge_commit_sha TEXT,
      has_commits_since_merge BOOLEAN DEFAULT 0,
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE terminal_sessions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      shelltender_session_id TEXT,
      ai_state TEXT DEFAULT 'not-started',
      ai_state_updated_at TIMESTAMP,
      is_active BOOLEAN DEFAULT 1,
      message_count INTEGER DEFAULT 0,
      size_bytes INTEGER DEFAULT 0,
      token_usage JSON,
      tool_usage JSON,
      model TEXT,
      error_count INTEGER DEFAULT 0,
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('Creating Models instance...');
  const models = new Models(db);

  console.log('\n=== Testing ProjectModel ===');
  const project = await models.projects.create({
    name: 'Test Project',
    repo_url: 'https://github.com/test/repo',
    metadata: { description: 'A test project' }
  });
  console.log('✓ Created project:', project.id);

  const foundProject = await models.projects.findById(project.id);
  console.log('✓ Found project by ID:', foundProject.name);

  const activeProjects = await models.projects.findActive();
  console.log('✓ Found active projects:', activeProjects.length);

  console.log('\n=== Testing TaskModel ===');
  const task = await models.tasks.create({
    project_id: project.id,
    name: 'Test Task',
    branch: 'feature/test',
    worktree_path: '/tmp/worktree',
    metadata: { priority: 'high' }
  });
  console.log('✓ Created task:', task.id);

  const projectTasks = await models.tasks.findByProjectId(project.id);
  console.log('✓ Found tasks for project:', projectTasks.length);

  console.log('\n=== Testing SessionModel ===');
  const session = await models.sessions.create({
    task_id: task.id,
    session_id: 'session-123',
    ai_state: 'working',
    token_usage: { input: 100, output: 50 }
  });
  console.log('✓ Created session:', session.id);

  const taskSessions = await models.sessions.findByTaskId(task.id);
  console.log('✓ Found sessions for task:', taskSessions.length);

  console.log('\n=== Testing SettingsModel ===');
  await models.settings.set('test.feature', 'enabled');
  const settingValue = await models.settings.get('test.feature');
  console.log('✓ Set and retrieved setting:', settingValue);

  console.log('\n=== Testing Models convenience methods ===');
  const stats = await models.getStats();
  console.log('✓ Got stats:', stats);

  console.log('\n✅ All basic CRUD operations working!');
  
  await db.close();
}

// Run tests
testModels().catch(console.error);