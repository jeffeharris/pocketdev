# PocketDev Persistence Migration Plan

## Overview
Migrate the current file-based project management system to a SQLite database for robust persistence, better data integrity, and automated cleanup of orphaned resources.

## Current Status: Phase 4 - Testing & Deployment
- ✅ Database schema implemented
- ✅ All models created (Project, Task, Session)
- ✅ Database-backed server implemented (`project-manager-db.cjs`)
- ✅ API endpoints converted to use SQLite
- ✅ Session analytics tracking integrated
- ✅ Worktree cleanup functionality added
- 🔄 Testing server startup and persistence
- ⏳ Frontend integration pending

## Goals
1. **Data Persistence**: All project, task, and session data persists across server restarts
2. **Data Integrity**: Proper relationships between projects, tasks, and sessions
3. **Automated Cleanup**: Identify and clean up orphaned worktrees
4. **Credential Management**: Secure storage of git credentials
5. **Session Tracking**: Track Claude sessions with analytics
6. **Audit Trail**: Log important operations for debugging

## Database Schema Design

### Core Tables
1. **projects**
   - id, name, repo_url, base_branch, local_path
   - timestamps: created_at, updated_at, last_accessed
   - is_archived flag for soft deletes
   - metadata JSON for flexibility

2. **tasks**
   - id, project_id (FK), name, branch, worktree_path
   - status: active, completed, archived
   - has_uncommitted_changes, last_commit_sha
   - timestamps and metadata

3. **claude_sessions**
   - id, task_id (FK), session_id (Claude's ID)
   - is_active, message_count, size_bytes
   - token_usage, tool_usage, model, error_count
   - Full analytics tracking

4. **git_credentials**
   - Encrypted storage for PATs/passwords
   - Provider info (GitHub, GitLab, etc.)
   - Default credential selection

5. **worktree_registry**
   - Track all worktrees for cleanup
   - Mark orphaned worktrees
   - Link to tasks/projects

6. **settings**
   - Key-value store for system settings
   - Session persistence preference
   - Default paths, etc.

7. **audit_log**
   - Track all important operations
   - Debugging and history

## Components That Need Changes

### 1. Database Layer (New)
- **File**: `simple/db/database.js`
  - SQLite initialization
  - Connection management
  - Migration runner
  - Basic query helpers

- **File**: `simple/db/models.js`
  - Project model with CRUD operations
  - Task model with worktree management
  - Session model with analytics
  - Credentials model with encryption
  - Worktree registry operations

### 2. Project Manager Updates
- **File**: `simple/project-manager.js`
  - Current: Reads/writes to `data/projects.json`
  - Change to: Use database for all operations
  - Add: Data migration from JSON to SQLite
  - Add: Worktree cleanup on startup

### 3. Server API Updates
- **File**: `simple/server/server.js`
  - Initialize database on startup
  - Update all endpoints to use database
  - Add new endpoints:
    - `/api/credentials` - Manage git credentials
    - `/api/cleanup` - Trigger worktree cleanup
    - `/api/migrate` - Run data migration

### 4. Frontend Updates
- **Files**: All HTML files in `simple/frontend/`
  - Add loading states during migration
  - Show database connection status
  - Add credentials management UI
  - Add cleanup options in settings

### 5. Git Integration
- **New File**: `simple/lib/git-manager.js`
  - Handle git operations with stored credentials
  - Clone with credentials
  - Check uncommitted changes
  - Get last commit SHA

### 6. Session Analytics
- **New File**: `simple/lib/session-analyzer.js`
  - Parse Claude session files
  - Extract token usage, tool usage
  - Calculate costs
  - Store in database

### 7. Cleanup Service
- **New File**: `simple/lib/cleanup-service.js`
  - Scan filesystem for worktrees
  - Match against database
  - Identify orphans
  - Safe deletion with backups

## Migration Strategy

### Phase 1: Database Setup
1. Install SQLite dependencies
2. Create database module
3. Implement schema and migrations
4. Test database operations

### Phase 2: Model Implementation
1. Create model classes
2. Implement CRUD operations
3. Add validation and error handling
4. Write unit tests

### Phase 3: Data Migration
1. Read existing `projects.json`
2. Scan filesystem for worktrees
3. Parse Claude sessions
4. Populate database
5. Verify data integrity

### Phase 4: API Migration
1. Update endpoints one by one
2. Maintain backward compatibility temporarily
3. Add new endpoints
4. Update error handling

### Phase 5: Frontend Updates
1. Add database status indicator
2. Update project/task management
3. Add credentials UI
4. Add cleanup UI

### Phase 6: Cleanup & Optimization
1. Remove old JSON-based code
2. Add database indexes
3. Implement connection pooling
4. Add backup/restore functionality

## Implementation Progress

### ✅ Completed

1. **Database Infrastructure**
   - SQLite dependencies installed (`sqlite3`, `sqlite`)
   - Schema created in `db/schema.sql`
   - Database initialization in `db/index.cjs`

2. **Core Models**
   - Project model (`db/models/project.cjs`)
   - Task model (`db/models/task.cjs`)
   - Session model (`db/models/session.cjs`)
   - Full CRUD operations implemented

3. **API Updates**
   - Created `project-manager-db.cjs` with database integration
   - All endpoints converted to use SQLite
   - New cleanup endpoints added
   - Session analytics integrated

4. **Worktree Management**
   - Orphaned worktree detection
   - Cleanup API endpoints
   - Worktree registry tracking

### 🔄 In Progress

5. **Testing & Deployment**
   - Server startup testing
   - Data persistence verification
   - Module compatibility fixes

### ⏳ Pending

6. **Frontend Integration**
   - Update dashboards for database
   - Add cleanup UI
   - Session analytics display

7. **Advanced Features**
   - Credential encryption
   - Automated backups
   - JSON data migration tool

## Testing Plan

1. **Unit Tests**
   - Database operations
   - Model methods
   - Migration logic

2. **Integration Tests**
   - API endpoints
   - Full workflows
   - Data consistency

3. **Migration Tests**
   - Test with sample data
   - Test with corrupted data
   - Performance testing

4. **Manual Testing**
   - UI functionality
   - Edge cases
   - Error scenarios

## Rollback Plan

1. Keep JSON files as backup during migration
2. Add export-to-JSON functionality
3. Database backup before major operations
4. Feature flags for gradual rollout

## Security Considerations

1. **Credentials Encryption**
   - Use node crypto for encryption
   - Store encryption key securely
   - Never log credentials

2. **SQL Injection Prevention**
   - Use parameterized queries
   - Input validation
   - Prepared statements

3. **Access Control**
   - Validate all inputs
   - Sanitize file paths
   - Prevent directory traversal

## Performance Considerations

1. **Indexes**
   - Add indexes for common queries
   - Monitor query performance
   - Optimize slow queries

2. **Connection Pooling**
   - Reuse database connections
   - Handle connection limits
   - Graceful degradation

3. **Caching**
   - Cache frequently accessed data
   - Invalidate cache on updates
   - Memory usage monitoring

## Monitoring & Maintenance

1. **Health Checks**
   - Database connection status
   - Disk space for database
   - Query performance metrics

2. **Automated Cleanup**
   - Schedule worktree cleanup
   - Archive old sessions
   - Compress audit logs

3. **Backup Strategy**
   - Daily database backups
   - Retain backups for 30 days
   - Test restore process

## Success Criteria

1. All existing functionality works with SQLite
2. Zero data loss during migration
3. Improved performance for large datasets
4. Automated cleanup reduces disk usage
5. Credentials stored securely
6. Full audit trail available
7. Easy backup/restore process

## Risks & Mitigations

1. **Data Loss**
   - Mitigation: Comprehensive backups, gradual migration

2. **Performance Degradation**
   - Mitigation: Proper indexing, connection pooling

3. **Migration Failures**
   - Mitigation: Rollback plan, extensive testing

4. **Security Vulnerabilities**
   - Mitigation: Security audit, encryption, input validation

## Next Steps

1. Review and approve plan
2. Set up development environment
3. Create feature branch
4. Begin Phase 1 implementation
5. Daily progress updates