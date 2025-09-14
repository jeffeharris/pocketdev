#!/usr/bin/env node

// Test script to check if terminals are actually being deleted from the database

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function checkDatabase() {
  try {
    // Query to check terminal sessions
    const query = `
      SELECT 
        id as db_session_id,
        task_id,
        session_id,
        shelltender_session_id,
        is_active,
        tab_name,
        created_at,
        datetime(created_at) as created_datetime
      FROM terminal_sessions 
      ORDER BY created_at DESC 
      LIMIT 20;
    `;
    
    console.log('Checking terminal sessions in database...\n');
    
    // Execute query in Docker container
    const { stdout, stderr } = await execPromise(
      `docker exec backend sh -c "cat > /tmp/query.sql << 'EOF'
${query}
EOF
cat /tmp/query.sql | sqlite3 -header -column /app/data/pocketdev.db"`
    );
    
    if (stderr) {
      console.error('Error:', stderr);
    }
    
    console.log('Terminal Sessions in Database:');
    console.log('================================');
    console.log(stdout || 'No sessions found');
    
    // Count total sessions
    const countQuery = 'SELECT COUNT(*) as total FROM terminal_sessions;';
    const { stdout: countStdout } = await execPromise(
      `docker exec backend sh -c "echo '${countQuery}' | sqlite3 /app/data/pocketdev.db"`
    );
    
    console.log('\nTotal terminal sessions in database:', countStdout.trim());
    
    // Check for orphaned sessions (no corresponding task)
    const orphanQuery = `
      SELECT 
        s.id as session_id,
        s.task_id,
        s.tab_name,
        s.created_at
      FROM terminal_sessions s
      LEFT JOIN tasks t ON s.task_id = t.id
      WHERE t.id IS NULL;
    `;
    
    const { stdout: orphanStdout } = await execPromise(
      `docker exec backend sh -c "cat > /tmp/orphan.sql << 'EOF'
${orphanQuery}
EOF
cat /tmp/orphan.sql | sqlite3 -header -column /app/data/pocketdev.db"`
    );
    
    console.log('\nOrphaned Sessions (no task):');
    console.log('=============================');
    console.log(orphanStdout || 'No orphaned sessions found');
    
  } catch (error) {
    console.error('Failed to check database:', error.message);
  }
}

// Run the check
checkDatabase();