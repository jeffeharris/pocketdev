-- Fix missing PRIMARY KEY constraint on tasks table
-- This migration recreates the tasks table with proper PRIMARY KEY constraint

-- First, create a new table with the correct structure
CREATE TABLE IF NOT EXISTS tasks_new (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    branch TEXT NOT NULL,
    worktree_path TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    is_archived BOOLEAN DEFAULT 0,
    has_uncommitted_changes BOOLEAN DEFAULT 0,
    last_commit_sha TEXT,
    merged_at TIMESTAMP DEFAULT NULL,
    merge_commit_sha TEXT DEFAULT NULL,
    has_commits_since_merge BOOLEAN DEFAULT 0,
    metadata JSON,
    parent_task_id TEXT,
    continuation_of TEXT,
    sequence_number INT,
    pr_url TEXT,
    pr_status TEXT,
    pr_number INT,
    remote_branch_deleted BOOLEAN DEFAULT 0,
    remote_branch_exists BOOLEAN DEFAULT 1,
    deletion_type TEXT,
    deletion_reason TEXT,
    deleted_by TEXT,
    deleted_at TIMESTAMP,
    final_diff_patch TEXT,
    branch_backup_ref TEXT,
    can_restore BOOLEAN DEFAULT 0,
    restore_deadline TIMESTAMP,
    commit_count INT DEFAULT 0,
    lines_added INT DEFAULT 0,
    lines_removed INT DEFAULT 0,
    files_changed INT DEFAULT 0,
    split_layout JSON,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Copy data from old table to new table, mapping columns explicitly
INSERT INTO tasks_new (
    id, project_id, name, branch, worktree_path, status,
    created_at, updated_at, completed_at, is_archived, 
    has_uncommitted_changes, last_commit_sha, merged_at,
    merge_commit_sha, has_commits_since_merge, metadata,
    parent_task_id, continuation_of, sequence_number,
    pr_url, pr_status, pr_number, remote_branch_deleted,
    remote_branch_exists, deletion_type, deletion_reason,
    deleted_by, deleted_at, final_diff_patch, branch_backup_ref,
    can_restore, restore_deadline, commit_count, lines_added,
    lines_removed, files_changed, split_layout
)
SELECT 
    id, project_id, name, branch, worktree_path, status,
    created_at, updated_at, completed_at, is_archived, 
    has_uncommitted_changes, last_commit_sha, merged_at,
    NULL as merge_commit_sha, has_commits_since_merge, metadata,
    parent_task_id, continuation_of, sequence_number,
    pr_url, pr_status, pr_number, remote_branch_deleted,
    remote_branch_exists, deletion_type, deletion_reason,
    deleted_by, deleted_at, final_diff_patch, branch_backup_ref,
    can_restore, restore_deadline, commit_count, lines_added,
    lines_removed, files_changed, split_layout
FROM tasks;

-- Drop the old table
DROP TABLE tasks;

-- Rename the new table to tasks
ALTER TABLE tasks_new RENAME TO tasks;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Recreate the update trigger
DROP TRIGGER IF EXISTS update_tasks_timestamp;
CREATE TRIGGER update_tasks_timestamp 
    AFTER UPDATE ON tasks
    BEGIN
        UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;