# Phase 1 Database Schema - Single User Focus

This simplified schema focuses on getting core functionality working for a single user before adding multi-tenancy complexity.

## Core Tables for Phase 1

```sql
-- Projects (simplified - no team association yet)
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  repository_url TEXT NOT NULL UNIQUE,
  default_branch TEXT NOT NULL DEFAULT 'main',
  description TEXT,
  
  -- Git info
  github_owner TEXT,
  github_repo TEXT,
  
  -- Settings
  auto_create_pr BOOLEAN DEFAULT true,
  require_tests BOOLEAN DEFAULT true,
  default_review_timeout_minutes INTEGER DEFAULT 10,
  
  -- Credentials (encrypted)
  encrypted_github_token TEXT,
  github_username TEXT,
  
  -- Metadata
  last_activity_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Stats
  total_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  total_cost_usd DECIMAL(10, 4) DEFAULT 0
);

-- Engineer Profiles (simplified - no team association)
CREATE TABLE engineer_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN (
    'frontend', 'backend', 'devops', 'fullstack',
    'qa_manual', 'qa_automation', 'qa_performance',
    'designer', 'architect', 'product',
    'support', 'sre'
  )),
  
  -- System prompts
  base_system_prompt TEXT,
  custom_instructions TEXT,
  
  -- Performance metrics
  total_tasks INTEGER DEFAULT 0,
  successful_tasks INTEGER DEFAULT 0,
  average_duration_ms INTEGER,
  average_turns DECIMAL(4,1),
  total_cost_usd DECIMAL(10, 4) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks (core functionality)
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  engineer_profile_id UUID REFERENCES engineer_profiles(id),
  
  -- Task details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  acceptance_criteria JSONB DEFAULT '[]',
  task_type TEXT CHECK (task_type IN (
    'feature', 'bugfix', 'refactor', 'test', 'docs',
    'investigation', 'design', 'architecture', 'support'
  )),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'queued' 
    CHECK (status IN ('queued', 'in_progress', 'awaiting_review', 'accepted', 'rejected', 'failed')),
  priority INTEGER DEFAULT 0,
  
  -- Git info
  base_branch TEXT,
  feature_branch TEXT,
  pr_url TEXT,
  commit_hash TEXT,
  
  -- Metrics
  duration_ms INTEGER,
  cost_usd DECIMAL(10, 4),
  tokens_input INTEGER,
  tokens_output INTEGER,
  num_turns INTEGER,
  
  -- Results
  result_summary TEXT,
  files_changed JSONB, -- [{path, additions, deletions}]
  test_results JSONB,  -- {total, passed, failed}
  error_message TEXT,
  
  -- Container info
  container_id TEXT,
  workspace_path TEXT,
  session_id TEXT,
  
  -- Review
  review_status TEXT CHECK (review_status IN ('pending', 'approved', 'changes_requested')),
  review_comments TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Task history for tracking state changes
CREATE TABLE task_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'started', 'completed', 'failed', 
    'reviewed', 'accepted', 'rejected', 'follow_up_requested'
  )),
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_engineer ON tasks(engineer_profile_id);
CREATE INDEX idx_task_events_task ON task_events(task_id);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);

-- Enable real-time for tasks
ALTER TABLE tasks REPLICA IDENTITY FULL;
ALTER TABLE task_events REPLICA IDENTITY FULL;

-- Insert default engineer profiles
INSERT INTO engineer_profiles (name, role, base_system_prompt) VALUES
  ('Claude Frontend', 'frontend', 'You are a senior frontend engineer specializing in React and TypeScript. Focus on component architecture, accessibility, and user experience.'),
  ('Claude Backend', 'backend', 'You are a backend architect specializing in scalable APIs. Focus on security, performance, and proper error handling.'),
  ('Claude DevOps', 'devops', 'You are a DevOps specialist focusing on automation and infrastructure. Create reproducible deployments and comprehensive monitoring.'),
  ('Claude Fullstack', 'fullstack', 'You are a fullstack engineer capable of building complete features. Balance frontend usability with backend reliability.');
```

## Views for Common Queries

```sql
-- Active tasks view
CREATE VIEW active_tasks AS
SELECT 
  t.*,
  p.name as project_name,
  p.repository_url,
  e.name as engineer_name,
  e.role as engineer_role
FROM tasks t
JOIN projects p ON t.project_id = p.id
LEFT JOIN engineer_profiles e ON t.engineer_profile_id = e.id
WHERE t.status IN ('queued', 'in_progress', 'awaiting_review');

-- Task metrics by project
CREATE VIEW project_metrics AS
SELECT 
  p.id,
  p.name,
  COUNT(t.id) as total_tasks,
  COUNT(t.id) FILTER (WHERE t.status = 'accepted') as accepted_tasks,
  COUNT(t.id) FILTER (WHERE t.status = 'failed') as failed_tasks,
  AVG(t.duration_ms) as avg_duration_ms,
  SUM(t.cost_usd) as total_cost_usd,
  AVG(t.num_turns) as avg_turns
FROM projects p
LEFT JOIN tasks t ON p.id = t.project_id
GROUP BY p.id, p.name;

-- Engineer performance view
CREATE VIEW engineer_performance AS
SELECT 
  e.id,
  e.name,
  e.role,
  COUNT(t.id) as total_tasks,
  COUNT(t.id) FILTER (WHERE t.status = 'accepted') as successful_tasks,
  AVG(t.duration_ms) as avg_duration_ms,
  AVG(t.num_turns) as avg_turns,
  SUM(t.cost_usd) as total_cost_usd
FROM engineer_profiles e
LEFT JOIN tasks t ON e.id = t.engineer_profile_id
GROUP BY e.id, e.name, e.role;
```

## Migration Notes

1. **From Current State**
   - Load existing engineers as profiles
   - Convert in-memory tasks to database records
   - Migrate workspace results to task records

2. **Credential Security**
   - Use Supabase Vault or app-level encryption
   - Never store plain text tokens
   - Rotate credentials regularly

3. **Real-time Updates**
   - Subscribe to task status changes
   - Update UI without polling
   - Show live progress

4. **Future Compatibility**
   - Schema designed to add team_id later
   - Can add user_id for multi-user
   - Prepared for role-based access