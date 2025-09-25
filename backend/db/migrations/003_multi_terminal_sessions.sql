-- Migration: Add support for multiple terminal sessions per task
-- Date: 2024-01-21
-- Description: Enables multiple concurrent terminal sessions (tabs) within a single task

-- Add new columns to terminal_sessions table
ALTER TABLE terminal_sessions ADD COLUMN tab_name VARCHAR(255) DEFAULT 'Main';
ALTER TABLE terminal_sessions ADD COLUMN tab_order INTEGER DEFAULT 0;
ALTER TABLE terminal_sessions ADD COLUMN ai_session_id VARCHAR(255);
ALTER TABLE terminal_sessions ADD COLUMN ai_agent VARCHAR(50) DEFAULT 'claude';

-- Add columns for session branching support (future feature)
ALTER TABLE terminal_sessions ADD COLUMN parent_session_id VARCHAR(255);
ALTER TABLE terminal_sessions ADD COLUMN branch_purpose VARCHAR(255);
ALTER TABLE terminal_sessions ADD COLUMN is_branch BOOLEAN DEFAULT FALSE;

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_tab_order ON terminal_sessions(task_id, tab_order);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_ai_agent ON terminal_sessions(ai_agent);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_parent ON terminal_sessions(parent_session_id);

-- Update existing sessions to have proper tab_name and tab_order
UPDATE terminal_sessions 
SET tab_name = 'Main', 
    tab_order = 0,
    ai_agent = 'claude'
WHERE tab_name IS NULL;

-- Note: We intentionally do NOT add a unique constraint on (task_id, is_active)
-- to allow multiple active sessions per task