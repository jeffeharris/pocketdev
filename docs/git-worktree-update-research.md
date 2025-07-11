# Git Worktree Update Strategy for PocketDev

## Research Summary

This document outlines how to properly update git worktrees when the remote repository has new changes, based on research and analysis of the PocketDev implementation.

## How Worktrees Relate to the Main Repository

1. **Shared Repository Model**: All worktrees share the same git repository database (`.git` directory)
   - The main worktree contains the actual `.git` directory
   - Linked worktrees have a `.git` file pointing to the shared repository
   - This means `git fetch` from any worktree updates the shared repository for all worktrees

2. **Independent Working Trees**: Each worktree has its own:
   - HEAD (current branch pointer)
   - Index (staging area)
   - Working directory files
   - Local configuration

## Best Practices for Updating Worktrees

### 1. Fetch Once, Update Many
Since all worktrees share the same repository database, you only need to fetch once:

```bash
# From any worktree (main or linked)
git fetch origin

# This updates all remote tracking branches for all worktrees
```

### 2. Update Individual Worktrees
After fetching, each worktree needs to be updated individually:

```bash
# Navigate to specific worktree
cd /path/to/worktree

# Option 1: Merge remote changes
git merge origin/branch-name

# Option 2: Rebase on remote changes
git rebase origin/branch-name

# Option 3: Pull (fetch + merge in one command)
git pull origin branch-name
```

### 3. Set Up Proper Branch Tracking
PocketDev creates worktrees with new branches, but they may not track remote branches:

```bash
# Set upstream tracking for better pull/push experience
git branch --set-upstream-to=origin/branch-name branch-name
```

## Current PocketDev Implementation Analysis

Looking at the codebase, PocketDev creates worktrees like this:

```javascript
// From project-manager.js
await execAsync(`git worktree add -b ${branch} ${worktreePath} ${project.baseBranch}`, { 
  cwd: project.path 
});
```

This creates a new branch based on the project's base branch (e.g., `main`), but:
- The new branch doesn't track any remote branch
- Updates to the base branch won't automatically flow to task branches

## Recommendations for PocketDev

### 1. Add Update Functionality

Create new API endpoints for updating:

```javascript
// Update all remote refs for a project
app.post('/api/projects/:projectId/fetch', async (req, res) => {
  const project = projects.get(req.params.projectId);
  // Run git fetch from the main repository
  await gitCommand(project.path, 'git fetch --all --prune');
});

// Update a specific task's worktree
app.post('/api/projects/:projectId/tasks/:taskId/update', async (req, res) => {
  const { strategy = 'merge' } = req.body; // merge or rebase
  const task = project.tasks.find(t => t.id === req.params.taskId);
  
  // First fetch latest changes
  await gitCommand(project.path, 'git fetch origin');
  
  // Then update the worktree
  if (strategy === 'rebase') {
    await gitCommand(task.worktreePath, `git rebase origin/${project.baseBranch}`);
  } else {
    await gitCommand(task.worktreePath, `git merge origin/${project.baseBranch}`);
  }
});
```

### 2. Add Status Checking

Before updating, check if updates are available:

```javascript
// Check if worktree is behind remote
app.get('/api/projects/:projectId/tasks/:taskId/update-status', async (req, res) => {
  const task = project.tasks.find(t => t.id === req.params.taskId);
  
  // Fetch latest (doesn't change working tree)
  await gitCommand(project.path, 'git fetch origin');
  
  // Check if behind
  const behind = await gitCommand(task.worktreePath, 
    `git rev-list --count HEAD..origin/${project.baseBranch}`
  );
  
  // Check if ahead
  const ahead = await gitCommand(task.worktreePath, 
    `git rev-list --count origin/${project.baseBranch}..HEAD`
  );
  
  res.json({
    behind: parseInt(behind.output),
    ahead: parseInt(ahead.output),
    upToDate: behind.output.trim() === '0'
  });
});
```

### 3. Handle Update Conflicts

Provide conflict resolution workflow:

```javascript
// Check for conflicts before updating
const hasConflicts = await checkForConflicts(task.worktreePath, project.baseBranch);
if (hasConflicts) {
  return res.json({
    success: false,
    hasConflicts: true,
    message: 'Updates would cause conflicts. Manual resolution required.'
  });
}
```

### 4. Add Batch Update Operations

For updating multiple tasks at once:

```javascript
// Update all tasks in a project
app.post('/api/projects/:projectId/update-all-tasks', async (req, res) => {
  // First fetch once for the entire project
  await gitCommand(project.path, 'git fetch --all');
  
  // Then update each task
  const results = [];
  for (const task of project.tasks) {
    try {
      await gitCommand(task.worktreePath, `git merge origin/${project.baseBranch}`);
      results.push({ taskId: task.id, success: true });
    } catch (error) {
      results.push({ taskId: task.id, success: false, error: error.message });
    }
  }
  
  res.json({ results });
});
```

### 5. UI Considerations

The mobile UI should:
- Show update indicators when remote has new commits
- Provide one-tap update for individual tasks
- Show clear conflict warnings before attempting updates
- Allow choosing between merge and rebase strategies
- Provide batch update options with safety checks

## Special Considerations

### 1. Performance
- Fetching updates the shared repository, so it only needs to be done once
- Avoid fetching repeatedly for each worktree
- Consider caching fetch status with timestamps

### 2. Safety
- Always check for uncommitted changes before updating
- Warn about potential conflicts before attempting updates
- Provide rollback options if updates fail

### 3. Mobile-First Design
- Minimize data usage by fetching only when necessary
- Provide clear visual indicators of update status
- Use progressive disclosure for advanced options (merge vs rebase)

### 4. Automation Options
- Could add auto-fetch on a schedule
- Could add notifications when updates are available
- Could add smart conflict detection before updates

## Implementation Priority

1. **High Priority**: Add basic fetch and update endpoints
2. **Medium Priority**: Add conflict detection and status checking
3. **Low Priority**: Add batch operations and automation features

This approach ensures PocketDev can keep worktrees in sync with remote changes while maintaining the mobile-first, developer-friendly experience.