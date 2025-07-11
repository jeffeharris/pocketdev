-- Migration: Task Lifecycle Improvements
-- Version: 001
-- Description: Adds fields for task continuation, lifecycle tracking, and branch management

-- Add task chain relationship fields
ALTER TABLE tasks ADD COLUMN parent_task_id TEXT;
ALTER TABLE tasks ADD COLUMN continuation_of TEXT;
ALTER TABLE tasks ADD COLUMN task_chain_id TEXT;
ALTER TABLE tasks ADD COLUMN sequence_number INTEGER DEFAULT 1;

-- Add PR tracking fields
ALTER TABLE tasks ADD COLUMN pr_url TEXT;
ALTER TABLE tasks ADD COLUMN pr_status TEXT CHECK (pr_status IN ('open', 'merged', 'closed', NULL));
ALTER TABLE tasks ADD COLUMN pr_number INTEGER;
ALTER TABLE tasks ADD COLUMN remote_branch_deleted BOOLEAN DEFAULT 0;
ALTER TABLE tasks ADD COLUMN remote_branch_exists BOOLEAN DEFAULT 1;

-- Add deletion tracking fields
ALTER TABLE tasks ADD COLUMN deletion_type TEXT CHECK (deletion_type IN ('merged', 'abandoned', 'completed', NULL));
ALTER TABLE tasks ADD COLUMN deletion_reason TEXT;
ALTER TABLE tasks ADD COLUMN deleted_by TEXT;
ALTER TABLE tasks ADD COLUMN deleted_at TIMESTAMP;

-- Add backup and recovery fields
ALTER TABLE tasks ADD COLUMN final_diff_patch TEXT;
ALTER TABLE tasks ADD COLUMN branch_backup_ref TEXT;
ALTER TABLE tasks ADD COLUMN can_restore BOOLEAN DEFAULT 1;
ALTER TABLE tasks ADD COLUMN restore_deadline TIMESTAMP;

-- Add work metrics fields
ALTER TABLE tasks ADD COLUMN commit_count INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN lines_added INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN lines_removed INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN files_changed INTEGER DEFAULT 0;

-- Create task lifecycle events table
CREATE TABLE IF NOT EXISTS task_lifecycle_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'created', 'started', 'paused', 'completed', 
        'archived', 'deleted', 'continued', 'backed_up',
        'restored', 'branch_deleted', 'pr_opened', 'pr_merged'
    )),
    event_data JSON,
    user_id TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_chain ON tasks(task_chain_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_continuation ON tasks(continuation_of);
CREATE INDEX IF NOT EXISTS idx_tasks_pr_status ON tasks(pr_status);
CREATE INDEX IF NOT EXISTS idx_tasks_deletion_type ON tasks(deletion_type);
CREATE INDEX IF NOT EXISTS idx_lifecycle_task ON task_lifecycle_events(task_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_type ON task_lifecycle_events(event_type);
CREATE INDEX IF NOT EXISTS idx_lifecycle_timestamp ON task_lifecycle_events(timestamp);

-- Update existing tasks to have task_chain_id
UPDATE tasks SET task_chain_id = id WHERE task_chain_id IS NULL;