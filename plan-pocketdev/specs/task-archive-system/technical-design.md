# Task Archive System Technical Design

<!-- Document Metadata
Created: 2025-08-18
Modified: 2025-08-18
Status: active
-->


## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│   Frontend UI   │────▶│  Backend API     │────▶│  File System   │
│  (Archive btn)  │     │  (Task Service)  │     │  (.archived/)  │
└─────────────────┘     └──────────────────┘     └────────────────┘
                               │                          │
                               ▼                          │
                        ┌──────────────────┐             │
                        │    Database      │             │
                        │  (is_archived)   │             │
                        └──────────────────┘             │
                               │                          │
                               ▼                          ▼
                        ┌──────────────────┐     ┌────────────────┐
                        │  Cleanup Service │────▶│  Shelltender   │
                        │  (30-day timer)  │     │  (Sessions)    │
                        └──────────────────┘     └────────────────┘
```

## Component Design

### 1. Task Service Changes

```javascript
// backend/services/task.service.js

class TaskService {
  /**
   * Archive task with session preservation
   */
  async archiveTask(taskId, options = {}) {
    const { preserveSessions = true } = options;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) throw new Error('Task not found');
    
    // Start transaction
    await this.db.beginTransaction();
    
    try {
      // 1. Mark as archived in database
      await this.models.tasks.update(taskId, {
        is_archived: true,
        archived_at: new Date().toISOString()
      });
      
      // 2. Move worktree to archive location
      const archivePath = this.generateArchivePath(task);
      await this.worktreeService.move(task.worktree_path, archivePath);
      
      // 3. Handle sessions (NEW: don't kill them)
      if (preserveSessions) {
        await this.preserveTaskSessions(taskId);
      } else {
        await this.cleanupTaskSessions(taskId);
      }
      
      // 4. Record archive metadata
      await this.models.archives.create({
        task_id: taskId,
        archive_path: archivePath,
        archive_size: await this.calculateDirectorySize(archivePath),
        session_ids: preserveSessions ? await this.getTaskSessionIds(taskId) : [],
        created_at: new Date().toISOString()
      });
      
      // 5. Emit event
      this.eventEmitter.emit('task-archived', { taskId, archivePath });
      
      await this.db.commit();
      
      return {
        success: true,
        archivePath,
        retentionDays: 30,
        canRestore: true
      };
    } catch (error) {
      await this.db.rollback();
      throw error;
    }
  }
  
  /**
   * Preserve sessions instead of killing them
   */
  async preserveTaskSessions(taskId) {
    const sessions = await this.models.terminalSessions.findByTaskId(taskId);
    
    for (const session of sessions) {
      // Mark session as archived but don't kill it
      await this.models.terminalSessions.update(session.id, {
        is_archived: true,
        archived_with_task: taskId
      });
      
      // Optionally disconnect WebSocket clients
      this.websocketService.disconnectSession(session.shelltender_id);
    }
  }
}
```

### 2. Archive Cleanup Service

```javascript
// backend/services/archive-cleanup.service.js

class ArchiveCleanupService {
  constructor(models, config) {
    this.models = models;
    this.retentionDays = config.retentionDays || 30;
    this.checkInterval = config.checkInterval || 3600000; // 1 hour
    this.storageThreshold = config.storageThreshold || 10 * 1024 * 1024 * 1024; // 10GB
  }
  
  start() {
    // Run immediately on startup
    this.performCleanup();
    
    // Schedule regular cleanup
    this.interval = setInterval(() => {
      this.performCleanup();
    }, this.checkInterval);
    
    console.log(`Archive cleanup service started (retention: ${this.retentionDays} days)`);
  }
  
  async performCleanup() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      
      // Find archives older than retention period
      const oldArchives = await this.models.archives.findOlderThan(cutoffDate);
      
      for (const archive of oldArchives) {
        await this.deleteArchive(archive);
      }
      
      // Check storage usage
      await this.checkStorageUsage();
      
    } catch (error) {
      console.error('Archive cleanup failed:', error);
    }
  }
  
  async deleteArchive(archive) {
    // 1. Kill any remaining sessions
    for (const sessionId of archive.session_ids || []) {
      try {
        await this.shelltenderClient.killSession(sessionId);
      } catch (error) {
        // Session might already be gone
      }
    }
    
    // 2. Delete archive directory
    await fs.rm(archive.archive_path, { recursive: true, force: true });
    
    // 3. Delete database record
    await this.models.archives.delete(archive.id);
    
    // 4. Clean up task if not already deleted
    await this.models.tasks.delete(archive.task_id);
    
    console.log(`Cleaned up archive: ${archive.task_id} (${archive.archive_path})`);
  }
  
  async checkStorageUsage() {
    const totalSize = await this.models.archives.getTotalSize();
    
    if (totalSize > this.storageThreshold) {
      this.eventEmitter.emit('archive-storage-warning', {
        current: totalSize,
        threshold: this.storageThreshold
      });
    }
  }
}
```

### 3. Database Schema Changes

```sql
-- Add archive tracking table
CREATE TABLE IF NOT EXISTS archives (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  archive_path TEXT NOT NULL,
  archive_size INTEGER,
  session_ids TEXT, -- JSON array of preserved session IDs
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Add archive fields to tasks table
ALTER TABLE tasks ADD COLUMN archived_at TEXT;
ALTER TABLE tasks ADD COLUMN archive_path TEXT;
ALTER TABLE tasks ADD COLUMN can_restore INTEGER DEFAULT 1;

-- Add archive tracking to terminal_sessions
ALTER TABLE terminal_sessions ADD COLUMN is_archived INTEGER DEFAULT 0;
ALTER TABLE terminal_sessions ADD COLUMN archived_with_task TEXT;

-- Create index for cleanup queries
CREATE INDEX idx_archives_expires_at ON archives(expires_at);
CREATE INDEX idx_tasks_archived_at ON tasks(archived_at);
```

### 4. API Endpoints

```javascript
// backend/routes/task.routes.js

// Archive task (soft delete)
router.post('/:taskId/archive', (req, res) => taskController.archiveTask(req, res));

// Restore archived task
router.post('/:taskId/restore', (req, res) => taskController.restoreTask(req, res));

// Get archive statistics
router.get('/archives/stats', (req, res) => taskController.getArchiveStats(req, res));

// List archived tasks
router.get('/archived', (req, res) => taskController.listArchivedTasks(req, res));

// Force cleanup old archives (admin)
router.post('/archives/cleanup', requireAdmin, (req, res) => taskController.forceCleanup(req, res));
```

### 5. Frontend Service Updates

```typescript
// frontend/src/services/task.service.ts

class TaskService extends BaseService {
  async archiveTask(projectId: string, taskId: string): Promise<ArchiveResult> {
    // Use dedicated archive endpoint instead of DELETE
    const result = await this.post<ArchiveResult>(
      `/projects/${projectId}/tasks/${taskId}/archive`
    );
    
    // Show user-friendly message
    this.notificationService.info(
      `Task archived. Can be restored within ${result.retentionDays} days.`
    );
    
    return result;
  }
  
  async restoreTask(projectId: string, taskId: string): Promise<Task> {
    return await this.post<Task>(
      `/projects/${projectId}/tasks/${taskId}/restore`
    );
  }
  
  async getArchiveStats(projectId?: string): Promise<ArchiveStats> {
    const url = projectId 
      ? `/projects/${projectId}/archives/stats`
      : `/archives/stats`;
    return await this.get<ArchiveStats>(url);
  }
}
```

## Storage Optimization Strategies

### Option 1: Git Bundle (Recommended)
```bash
# Create bundle with only task-specific commits
git bundle create archive.bundle base-branch..task-branch

# Restore from bundle
git clone archive.bundle -b task-branch restored-task
```

**Pros:**
- Compact storage (only differences)
- Preserves full git history
- Standard git format

**Cons:**
- Loses uncommitted changes
- Requires special handling for untracked files

### Option 2: Tar with Compression
```bash
# Archive with compression
tar -czf archive.tar.gz --exclude=node_modules --exclude=.git/objects worktree/

# Restore
tar -xzf archive.tar.gz -C restored-location/
```

**Pros:**
- Preserves everything including uncommitted work
- Simple implementation

**Cons:**
- Still stores full project (though compressed)
- No deduplication across archives

### Option 3: Differential Storage with Rsync
```bash
# Create differential backup
rsync -a --link-dest=../base-snapshot/ worktree/ archive/

# Restore
rsync -a archive/ restored-location/
```

**Pros:**
- Hard links for unchanged files (saves space)
- Preserves all file attributes

**Cons:**
- Complex restoration process
- Platform-specific (Linux/Unix)

## Monitoring and Alerts

```javascript
// backend/services/monitoring.service.js

class ArchiveMonitoringService {
  async getMetrics() {
    return {
      totalArchives: await this.models.archives.count(),
      totalSize: await this.models.archives.getTotalSize(),
      oldestArchive: await this.models.archives.getOldest(),
      expiringToday: await this.models.archives.getExpiringToday(),
      storageByProject: await this.models.archives.getSizeByProject(),
      averageArchiveSize: await this.models.archives.getAverageSize(),
      sessionPreservationRate: await this.calculateSessionPreservationRate()
    };
  }
  
  async checkAlerts() {
    const metrics = await this.getMetrics();
    
    // Alert if storage exceeds threshold
    if (metrics.totalSize > this.config.storageAlertThreshold) {
      this.alertService.send('ARCHIVE_STORAGE_HIGH', metrics);
    }
    
    // Alert if cleanup appears to be failing
    if (metrics.oldestArchive && 
        daysSince(metrics.oldestArchive.created_at) > this.config.retentionDays + 7) {
      this.alertService.send('ARCHIVE_CLEANUP_FAILING', metrics);
    }
  }
}
```

## Migration Plan

### Phase 1: Database Migration
1. Add new tables and columns
2. Backfill archive data for existing archived tasks
3. Update models to use new schema

### Phase 2: Service Implementation
1. Implement ArchiveCleanupService
2. Update TaskService to preserve sessions
3. Add monitoring service

### Phase 3: API Updates
1. Add new archive/restore endpoints
2. Update existing DELETE endpoint behavior
3. Add admin endpoints for management

### Phase 4: Frontend Updates
1. Update TaskService to use new endpoints
2. Add archive management UI
3. Show storage metrics in dashboard

### Phase 5: Deployment
1. Deploy database migrations
2. Deploy backend with cleanup service disabled
3. Verify archive operations work correctly
4. Enable cleanup service with monitoring
5. Deploy frontend updates

## Testing Strategy

### Unit Tests
- Archive operation with session preservation
- Cleanup service age calculation
- Storage size calculations
- Archive restoration

### Integration Tests
- Full archive/restore cycle
- Cleanup with active sessions
- Storage threshold alerts
- Concurrent archive operations

### Performance Tests
- Archive operation under 5 seconds for 1GB worktree
- Cleanup handling 1000+ archives
- Storage calculation caching

## Security Considerations

1. **Path Traversal**: Validate archive paths to prevent directory traversal
2. **Resource Limits**: Cap maximum archives per project
3. **Admin Access**: Require authentication for cleanup operations
4. **Audit Logging**: Log all archive/restore/delete operations

## Future Enhancements

1. **Incremental Archives**: Store only changes since last archive
2. **Archive Compression**: Automatic compression after N days
3. **S3 Storage**: Option to store archives in cloud storage
4. **Archive Sharing**: Generate shareable links for archived tasks
5. **Selective Restoration**: Restore only specific files from archive