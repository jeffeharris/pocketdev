# BUG-024: Create Pull Request Fails on Unpushed Branches

## Summary
The "Create Pull Request" functionality fails when the branch hasn't been pushed to remote yet, with error: "aborted: you must first push the current branch to a remote, or use the --head flag"

## Current Behavior
When attempting to create a PR through the UI, if the branch only exists locally, the `gh pr create` command fails because it expects the branch to already exist on the remote.

## Expected Behavior
The system should:
1. Check if the branch exists on remote
2. If not, push it automatically
3. Then create the pull request

## Error Details
```
[Git Service] Command failed: Command failed: gh pr create --title "Add game stats test - " --body "Created by Claude Code - Task: Add game stats test" --base dev
aborted: you must first push the current branch to a remote, or use the --head flag
```

## Root Cause
The PR creation logic doesn't handle the common workflow where developers commit locally but haven't pushed yet. The `gh pr create` command requires the branch to exist on remote unless the `--head` flag is used.

## Proposed Fix

### Option 1: Auto-push before PR creation
```javascript
async createPullRequest(taskId, title, body, baseBranch) {
  // Check if branch exists on remote
  const remoteBranches = await this.git.getRemoteBranches();
  const currentBranch = await this.git.getCurrentBranch();
  
  if (!remoteBranches.includes(currentBranch)) {
    // Push the branch first
    await this.git.push('origin', currentBranch, { setUpstream: true });
  }
  
  // Now create PR
  return await this.gh.createPR({ title, body, base: baseBranch });
}
```

### Option 2: Use --head flag
```javascript
async createPullRequest(taskId, title, body, baseBranch) {
  const currentBranch = await this.git.getCurrentBranch();
  
  // Use --head to specify the branch explicitly
  return await this.gh.createPR({ 
    title, 
    body, 
    base: baseBranch,
    head: currentBranch 
  });
}
```

## Impact
- Affects all users trying to create PRs from local-only branches
- Common workflow disruption
- Not related to recent service extraction changes

## Priority
Medium - Common user workflow is broken but has a manual workaround (push first, then create PR)

## Files to Check
- `/backend/services/git.service.js` - Line ~240: `createPullRequest()` method
- `/backend/controllers/task-pr.controller.js` - Line ~38: `createPullRequest()` endpoint
- The controller calls `gitService.createPullRequest()` which directly runs `gh pr create` without checking branch status

## Workaround
Users can manually push their branch before attempting to create a PR:
1. Use the terminal to run `git push -u origin branch-name`
2. Then use the Create PR button

## Testing
1. Create a new task/branch
2. Make commits without pushing
3. Attempt to create PR
4. Should either auto-push or handle unpushed branches gracefully