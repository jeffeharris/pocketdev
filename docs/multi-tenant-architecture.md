# PocketDev Multi-Tenant Architecture

## Overview

PocketDev is evolving from a single-user AI developer management tool to a multi-tenant platform where teams can manage pools of AI engineers across multiple projects. This document outlines the complete architecture, data model, and implementation strategy.

## Core Concepts

### 1. Separation of Concerns

- **Engineer Profiles**: The knowledge, personality, and expertise (persistent "brains")
- **Containers**: The compute resources that execute tasks (ephemeral "hands")
- **Projects**: Git repositories with associated context and settings
- **Tasks**: Units of work assigned to engineers

### 2. Knowledge Hierarchy

```
Base Role Knowledge → Team Preferences → Project Specifics → Learned Patterns
```

Each level adds context:
- **Base**: "I'm a React expert"
- **Team**: "We use TypeScript strictly"
- **Project**: "This app uses Redux Toolkit"
- **Learned**: "The auth flow is in /src/auth"

### 3. Engineer Roles

#### Development Roles
- **Frontend**: React, Vue, Angular, UI/UX implementation
- **Backend**: APIs, databases, business logic
- **DevOps**: Infrastructure, CI/CD, deployment
- **Fullstack**: Complete features across stack

#### Quality Roles
- **QA Manual**: Exploratory testing, user flows, UX validation
- **QA Automation**: Test scripts, CI integration, regression suites
- **QA Performance**: Load testing, optimization, benchmarking

#### Design & Planning Roles
- **Designer**: UI/UX design, mockups, design systems
- **Architect**: System design, technical documentation
- **Product**: Requirements, specifications, user stories

#### Support Roles
- **Support**: Bug investigation, troubleshooting, debugging
- **SRE**: Production issues, monitoring, reliability

## Database Schema

### Core Tables

```sql
-- Teams/Organizations
CREATE TABLE teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  container_limit INTEGER DEFAULT 3,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team membership
CREATE TABLE team_members (
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'admin', 'member')),
  PRIMARY KEY (team_id, user_id)
);

-- Projects
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
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
  
  -- Metadata
  last_activity_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Stats
  total_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  total_cost_usd DECIMAL(10, 4) DEFAULT 0
);

-- Encrypted credentials
CREATE TABLE project_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  credential_type TEXT NOT NULL CHECK (credential_type IN ('github_pat', 'github_app', 'ssh_key')),
  
  -- Encrypted fields
  encrypted_token TEXT,
  encrypted_private_key TEXT,
  
  -- Non-sensitive fields
  github_username TEXT,
  github_app_id TEXT,
  
  -- Metadata
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(project_id, credential_type)
);

-- Engineer Profiles
CREATE TABLE engineer_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN (
    'frontend', 'backend', 'devops', 'fullstack',
    'qa_manual', 'qa_automation', 'qa_performance',
    'designer', 'architect', 'product',
    'support', 'sre'
  )),
  
  -- Personality & expertise
  personality JSONB DEFAULT '{}',
  expertise JSONB DEFAULT '[]',
  
  -- System prompts
  base_system_prompt TEXT,
  team_preferences TEXT,
  
  -- Performance metrics
  total_tasks INTEGER DEFAULT 0,
  successful_tasks INTEGER DEFAULT 0,
  average_duration_ms INTEGER,
  average_turns DECIMAL(4,1),
  total_cost_usd DECIMAL(10, 4) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project-specific engineer knowledge
CREATE TABLE project_engineer_knowledge (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES engineer_profiles(id) ON DELETE CASCADE,
  
  custom_system_prompt TEXT,
  learned_patterns JSONB DEFAULT '[]',
  code_conventions JSONB DEFAULT '{}',
  common_issues JSONB DEFAULT '[]',
  
  tasks_completed INTEGER DEFAULT 0,
  success_rate DECIMAL(3,2),
  avg_turns_per_task DECIMAL(4,1),
  
  PRIMARY KEY (project_id, profile_id)
);

-- Engineer Containers
CREATE TABLE engineer_containers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  
  container_id TEXT UNIQUE,
  container_state TEXT CHECK (container_state IN (
    'available', 'assigned', 'working', 'verifying', 
    'awaiting_review', 'follow_up', 'cleanup', 'error'
  )),
  
  -- Current assignment
  current_profile_id UUID REFERENCES engineer_profiles(id),
  current_task_id UUID REFERENCES tasks(id),
  
  -- Review tracking
  review_started_at TIMESTAMP WITH TIME ZONE,
  review_timeout_minutes INTEGER DEFAULT 10,
  
  -- Cleanup verification
  cleanup_checklist JSONB DEFAULT '{
    "verificationScriptPassed": false,
    "gitStatusClean": false,
    "memoriesUpdated": false,
    "taskResultsSaved": false
  }',
  
  -- Resource info
  cpu_limit TEXT DEFAULT '2',
  memory_limit TEXT DEFAULT '4G',
  workspace_path TEXT,
  
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  assigned_profile_id UUID REFERENCES engineer_profiles(id),
  assigned_container_id UUID REFERENCES engineer_containers(id),
  
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
  files_changed JSONB,
  test_results JSONB,
  lines_added INTEGER,
  lines_removed INTEGER,
  
  -- QA Integration
  requires_qa BOOLEAN DEFAULT true,
  qa_status TEXT CHECK (qa_status IN ('pending', 'in_progress', 'passed', 'failed', 'skipped')),
  qa_task_id UUID REFERENCES tasks(id),
  
  -- Review
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_comments TEXT,
  
  -- Workspace
  workspace_path TEXT,
  session_id TEXT,
  
  -- For conversational tasks
  conversation_mode BOOLEAN DEFAULT false,
  output_type TEXT CHECK (output_type IN ('code', 'markdown', 'both')),
  
  -- Timestamps
  queued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge artifacts
CREATE TABLE knowledge_artifacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_by_profile_id UUID REFERENCES engineer_profiles(id),
  task_id UUID REFERENCES tasks(id),
  
  artifact_type TEXT CHECK (artifact_type IN (
    'design_doc', 'architecture', 'rfc', 'spec', 
    'investigation', 'postmortem', 'runbook', 'bug_report'
  )),
  
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_path TEXT,
  
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Container Lifecycle

### State Machine
```
AVAILABLE → ASSIGNED → WORKING → VERIFYING → AWAITING_REVIEW
                           ↓                        ↓
                        FAILED              ACCEPTED/REJECTED/TIMEOUT
                                                   ↓
                                              FOLLOW_UP
                                                   ↓
                                               CLEANUP → AVAILABLE
```

### Container Release Checklist
1. **Work Verification**
   - Verification script passed
   - Git status clean
   - No uncommitted changes

2. **Knowledge Management**
   - Engineer memories updated
   - Patterns documented
   - Project config updated

3. **Task Closure**
   - Results saved to database
   - Workspace archived

4. **Review Status**
   - Human review complete or timed out

## Knowledge Management

### Project Structure
```
.pocketdev/
├── config.json                 # Project configuration
├── team-memory.md             # Shared team knowledge
├── engineers/
│   ├── frontend.md            # Role-specific learnings
│   ├── backend.md
│   └── qa.md
├── guides/                    # Custom documentation
│   ├── api-patterns.md
│   ├── testing-strategy.md
│   └── deployment.md
├── BUGS.md                    # Bug tracking
└── sdks/                      # Internal tools docs
```

### Bug Tracking Format
```markdown
# BUGS.md

## High Priority
- [ ] #BUG-001: Login fails with special characters
  - **Found by**: QA Manual
  - **Severity**: High
  - **Steps**: [Reproduction steps]
  
## Medium Priority
- [ ] #BUG-002: Dashboard slow with >1000 items
  - **Found by**: QA Performance
  - **Severity**: Medium
  - **Metrics**: Load time >5s
```

## Task Workflows

### Development → QA Flow
1. Developer completes feature task
2. If `requires_qa` is true, QA task auto-created
3. QA engineer tests implementation
4. QA either passes or creates bug report
5. Bug report creates new fix task

### Conversational Workflow
1. User starts design/architecture session
2. Chat-like interface for exploration
3. Produces markdown artifacts
4. Artifacts stored in knowledge base
5. Referenced by implementation engineers

## Container Pool Management

### Scaling Logic
- Default: 3 containers per team
- Spin up additional for urgent tasks if others in review
- Auto-scale down after idle period
- Configurable limits based on team plan

### Assignment Algorithm
1. Check for available containers
2. If none, check if any in review > timeout
3. For urgent tasks, consider spinning up new
4. Otherwise, queue task by priority

## Security Considerations

- Credentials encrypted at rest (Supabase vault)
- Container isolation per team
- Git operations use team-specific credentials
- Workspace cleanup verified before release
- No credential persistence in containers

## Performance Optimizations

- Container warm pools for faster starts
- Knowledge caching at team/project level
- Incremental memory updates
- Archived workspace compression
- Database query optimization with indexes

## Future Enhancements

1. **CI/CD Integration**
   - Monitor build failures
   - Auto-create fix tasks
   - Performance regression detection

2. **Knowledge Sharing**
   - Cross-project pattern recognition
   - Team-wide best practices
   - Engineer specialization tracking

3. **Advanced QA**
   - Visual regression testing
   - Accessibility automation
   - Security scanning integration

4. **Multi-repo Projects**
   - Microservice coordination
   - Cross-repo dependencies
   - Distributed tracing