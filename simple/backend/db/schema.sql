-- PocketDev SQLite Database Schema

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    repo_url TEXT NOT NULL,
    base_branch TEXT DEFAULT 'main',
    local_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_archived BOOLEAN DEFAULT 0,
    metadata JSON
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
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
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Terminal sessions table (for Shelltender terminal sessions where AI agents work)
CREATE TABLE IF NOT EXISTS terminal_sessions (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    shelltender_session_id TEXT,
    ai_state TEXT DEFAULT 'not-started',
    ai_state_updated_at TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    size_bytes INTEGER DEFAULT 0,
    token_usage JSON,
    tool_usage JSON,
    model TEXT,
    error_count INTEGER DEFAULT 0,
    metadata JSON,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Git credentials table
CREATE TABLE IF NOT EXISTS git_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    token_encrypted TEXT NOT NULL,
    provider TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP,
    is_default BOOLEAN DEFAULT 0
);

-- Worktree registry
CREATE TABLE IF NOT EXISTS worktree_registry (
    path TEXT PRIMARY KEY,
    task_id TEXT,
    project_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_orphaned BOOLEAN DEFAULT 0,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- System settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_task_id ON terminal_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_active ON terminal_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_ai_state ON terminal_sessions(ai_state);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_shelltender_id ON terminal_sessions(shelltender_session_id);
CREATE INDEX IF NOT EXISTS idx_worktree_orphaned ON worktree_registry(is_orphaned);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(is_archived);

-- Triggers to update timestamps
CREATE TRIGGER IF NOT EXISTS update_projects_timestamp 
    AFTER UPDATE ON projects
    BEGIN
        UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_tasks_timestamp 
    AFTER UPDATE ON tasks
    BEGIN
        UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;