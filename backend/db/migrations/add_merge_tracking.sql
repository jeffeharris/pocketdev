-- Add merge tracking fields to tasks table
ALTER TABLE tasks ADD COLUMN merged_at TIMESTAMP DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN merge_commit_sha TEXT DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN has_commits_since_merge BOOLEAN DEFAULT 0;

-- Create index for finding merged tasks
CREATE INDEX IF NOT EXISTS idx_tasks_merged ON tasks(merged_at) WHERE merged_at IS NOT NULL;