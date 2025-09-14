# BUG-012: Extract Migration System from server.js

<!-- Document Metadata
Created: 2025-08-01
Modified: 2025-08-01
Status: ????
-->


## Summary
The backend entry point (server.js) contains hardcoded database migration checks and execution logic that violates Ousterhout's principles of deep modules and proper abstraction layers.

## Current State
- **File**: `/backend/server.js` (lines 53-123)
- **Problem**: 4 separate migration blocks with identical try-catch patterns
- **Impact**: Adding new migrations requires modifying the entry point

## Problems Identified
1. **Shallow module**: Migration logic exposed at the highest level
2. **Manual process**: Each migration manually checked and executed
3. **No version tracking**: No systematic way to track applied migrations
4. **Error prone**: Copy-paste pattern for each new migration

## Code Example
```javascript
// Current problematic pattern repeated 4 times:
try {
  const needsMigration = await db.get(
    `SELECT COUNT(*) as count FROM pragma_table_info('tasks') 
     WHERE name='merge_commit_sha'`
  );
  
  if (needsMigration.count === 0) {
    console.log('Running merge tracking migration...');
    const migrationPath = path.join(path.dirname(config.dbPath), 'migrations/add_merge_tracking.sql');
    const migration = await fs.readFile(migrationPath, 'utf8');
    await db.exec(migration);
    console.log('Migration completed');
  }
} catch (error) {
  console.error('Migration check failed:', error);
}
```

## Proposed Solution
Create a `MigrationRunner` class that:
1. Automatically discovers migration files by naming convention
2. Tracks applied migrations in a migrations table
3. Executes pending migrations in order
4. Provides rollback capability

## Implementation Steps
1. Create `/backend/db/MigrationRunner.js`
2. Implement migration discovery based on naming (001_*.sql, 002_*.sql)
3. Add migrations tracking table
4. Replace inline migration code with `await migrationRunner.runPending()`
5. Move existing migrations to follow naming convention

## Benefits
- **Deep module**: Complex migration logic hidden behind simple interface
- **Maintainable**: New migrations just require adding a file
- **Testable**: Migration runner can be tested in isolation
- **Professional**: Follows standard migration patterns

## Priority: Critical
This blocks proper initialization architecture and affects every developer adding database changes.

## Estimated Effort: 1-2 days

## Filed: 2025-08-01