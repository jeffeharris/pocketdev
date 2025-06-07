import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { randomUUID } from 'crypto';

// Projects table
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  repositoryUrl: text('repository_url').notNull().unique(),
  defaultBranch: text('default_branch').notNull().default('main'),
  description: text('description'),
  
  // Git info
  githubOwner: text('github_owner'),
  githubRepo: text('github_repo'),
  
  // Settings
  autoCreatePr: integer('auto_create_pr', { mode: 'boolean' }).default(true),
  requireTests: integer('require_tests', { mode: 'boolean' }).default(true),
  defaultReviewTimeoutMinutes: integer('default_review_timeout_minutes').default(10),
  
  // Credentials (encrypted)
  encryptedGithubToken: text('encrypted_github_token'),
  githubUsername: text('github_username'),
  
  // Metadata
  lastActivityAt: integer('last_activity_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  
  // Stats
  totalTasks: integer('total_tasks').default(0),
  completedTasks: integer('completed_tasks').default(0),
  totalCostUsd: real('total_cost_usd').default(0)
});

// Engineer Profiles
export const engineerProfiles = sqliteTable('engineer_profiles', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  
  name: text('name').notNull(),
  role: text('role').notNull(), // frontend, backend, devops, etc.
  
  // System prompts
  baseSystemPrompt: text('base_system_prompt'),
  customInstructions: text('custom_instructions'),
  
  // Performance metrics
  totalTasks: integer('total_tasks').default(0),
  successfulTasks: integer('successful_tasks').default(0),
  averageDurationMs: integer('average_duration_ms'),
  averageTurns: real('average_turns'),
  totalCostUsd: real('total_cost_usd').default(0),
  
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// Tasks
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  projectId: text('project_id').references(() => projects.id),
  engineerProfileId: text('engineer_profile_id').references(() => engineerProfiles.id),
  
  // Task details
  title: text('title').notNull(),
  description: text('description').notNull(),
  acceptanceCriteria: text('acceptance_criteria', { mode: 'json' }).default('[]'),
  taskType: text('task_type'), // feature, bugfix, refactor, etc.
  
  // Status
  status: text('status').notNull().default('queued'), // queued, in_progress, awaiting_review, accepted, rejected, failed
  priority: integer('priority').default(0),
  
  // Git info
  baseBranch: text('base_branch'),
  featureBranch: text('feature_branch'),
  prUrl: text('pr_url'),
  commitHash: text('commit_hash'),
  
  // Metrics
  durationMs: integer('duration_ms'),
  costUsd: real('cost_usd'),
  tokensInput: integer('tokens_input'),
  tokensOutput: integer('tokens_output'),
  numTurns: integer('num_turns'),
  
  // Results
  resultSummary: text('result_summary'),
  filesChanged: text('files_changed', { mode: 'json' }), // JSON array
  testResults: text('test_results', { mode: 'json' }), // JSON object
  errorMessage: text('error_message'),
  
  // Container info
  containerId: text('container_id'),
  workspacePath: text('workspace_path'),
  sessionId: text('session_id'),
  
  // Review
  reviewStatus: text('review_status'), // pending, approved, changes_requested
  reviewComments: text('review_comments'),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  
  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' })
});

// Task events for history tracking
export const taskEvents = sqliteTable('task_events', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  taskId: text('task_id').notNull().references(() => tasks.id),
  eventType: text('event_type').notNull(), // created, started, completed, failed, reviewed, accepted, rejected
  eventData: text('event_data', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// Relations (for Drizzle's query API)
import { relations } from 'drizzle-orm';

export const projectsRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks)
}));

export const engineerProfilesRelations = relations(engineerProfiles, ({ many }) => ({
  tasks: many(tasks)
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id]
  }),
  engineerProfile: one(engineerProfiles, {
    fields: [tasks.engineerProfileId],
    references: [engineerProfiles.id]
  }),
  events: many(taskEvents)
}));

export const taskEventsRelations = relations(taskEvents, ({ one }) => ({
  task: one(tasks, {
    fields: [taskEvents.taskId],
    references: [tasks.id]
  })
}));