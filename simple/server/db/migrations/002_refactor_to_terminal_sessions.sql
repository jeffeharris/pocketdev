-- Refactor claude_sessions to terminal_sessions
-- This better represents what we're tracking: terminal sessions where AI agents work

-- Rename the table
ALTER TABLE claude_sessions RENAME TO terminal_sessions;

-- Add new columns for terminal session tracking
ALTER TABLE terminal_sessions ADD COLUMN shelltender_session_id TEXT;
ALTER TABLE terminal_sessions ADD COLUMN ai_state TEXT DEFAULT 'not-started';
ALTER TABLE terminal_sessions ADD COLUMN ai_state_updated_at TIMESTAMP;

-- Update indexes
DROP INDEX IF EXISTS idx_sessions_task_id;
DROP INDEX IF EXISTS idx_sessions_active;

CREATE INDEX IF NOT EXISTS idx_terminal_sessions_task_id ON terminal_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_active ON terminal_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_ai_state ON terminal_sessions(ai_state);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_shelltender_id ON terminal_sessions(shelltender_session_id);