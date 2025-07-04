# Task State Machine Documentation

## Overview

The PocketDev task state machine manages the lifecycle of development tasks from creation through completion. This document explains how tasks transition between states, what triggers "needs attention" items, and how PR submission integrates with the state system.

## Core State Systems

### 1. Task States (Backend: `tasks.status`)

The primary task states stored in the database:

- **`active`** - Task is currently being worked on
- **`merged`** - Task has been merged into the base branch
- **`archived`** - Task has been soft-deleted/archived

### 2. AI Session States (Backend: `terminal_sessions.ai_state`)

Tracks the state of AI developers working on tasks:

- **`not-started`** - No AI session active (at bash prompt)
- **`idle`** - AI session active, waiting for user input (blue indicator)
- **`working`** - AI is thinking/processing (yellow indicator)
- **`waiting`** - AI needs user confirmation or input (purple indicator)

These states are managed by `AIStateTracker` class and map directly to frontend `WorkerStatus` enum values.

### 3. PR States (Backend: `tasks.pr_status`)

Pull request states (from migration 001):

- **`open`** - PR has been created and is open
- **`merged`** - PR has been merged
- **`closed`** - PR was closed without merging
- **`null`** - No PR created yet

## State Transitions

### Task Creation Flow
```
[No Task] → create task → [active + not-started]
                               ↓
                    AI session starts → [active + idle/working/waiting]
```

### PR Submission Flow
```
[active] → push changes → create PR → [active + pr_status: open]
              ↓                              ↓
         (optional)                    merge PR → [merged + pr_status: merged]
```

### Task Completion Flow
```
[active] → merge to base → [merged]
              ↓
         (optional) → archive → [archived]
```

## "Needs Attention" Logic

The dashboard determines items needing attention through `getProjectDashboard` endpoint:

### 1. Base Branch Sync Issues
- **Behind Origin**: Base branch is behind remote (`severity: warning`)
  - Action: Pull changes
- **Ahead of Origin**: Local base has unpushed commits (`severity: info`)
  - Action: Push to origin

### 2. Stale Tasks
- Tasks with no activity for 7+ days (`severity: warning`)
  - Actions: Open task, Archive

### 3. Merge Conflicts
- Tasks with conflicts against base branch (`severity: error`)
  - Actions: Open task, Resolve conflicts

### 4. Open Pull Requests
- Any open PRs for the project (`severity: info`)
  - Actions: View PR, Merge PR

### 5. AI Session States (Implicit)
- Tasks with `ai_state: waiting` show purple indicator
- These require user input to proceed

## PR Submission Integration

### Database Fields (from migration)
```sql
pr_url TEXT                    -- GitHub PR URL
pr_status TEXT                 -- open, merged, closed
pr_number INTEGER              -- PR number for gh CLI
remote_branch_exists BOOLEAN   -- Track if remote branch exists
```

### PR Creation Process
1. **Push Branch**: Ensure branch is pushed to origin
2. **Create PR**: Use GitHub CLI (`gh pr create`)
3. **Update Task**: Store PR URL and number
4. **Track Status**: Monitor PR state changes

### PR State in UI
- Tasks with open PRs show PR indicator
- PR status affects task actions available
- Merged PRs trigger task state transition

## State Persistence

### Live State Sources
1. **AI Monitor**: Real-time AI session states from terminals
2. **Git Status Monitor**: Branch sync status
3. **Database**: Persisted states when sessions inactive

### State Priority
```
Live AI Monitor State > Database Session State > Default State
```

## Recommended PR State Enhancement

To better integrate PR submission into the state machine:

### 1. Add PR Creation State
```javascript
// In needs attention logic
if (task.status === 'active' && task.gitStatus.ahead > 0 && !task.pr_number) {
  needsAttention.push({
    type: 'ready-for-pr',
    severity: 'info',
    message: `Task "${task.name}" has ${task.gitStatus.ahead} commits ready for PR`,
    details: { taskId: task.id, taskName: task.name, commitsAhead: task.gitStatus.ahead },
    actions: ['create-pr', 'push-changes']
  });
}
```

### 2. Add PR Review State
```javascript
// Track PR review status
if (task.pr_status === 'open' && task.pr_review_requested) {
  needsAttention.push({
    type: 'pr-needs-review',
    severity: 'warning',
    message: `PR #${task.pr_number} awaiting review`,
    details: { taskId: task.id, prNumber: task.pr_number },
    actions: ['view-pr', 'request-review']
  });
}
```

### 3. Add PR Conflict State
```javascript
// Check for PR merge conflicts
if (task.pr_status === 'open' && task.pr_has_conflicts) {
  needsAttention.push({
    type: 'pr-has-conflicts',
    severity: 'error',
    message: `PR #${task.pr_number} has merge conflicts`,
    details: { taskId: task.id, prNumber: task.pr_number },
    actions: ['resolve-pr-conflicts', 'update-branch']
  });
}
```

## State Machine Best Practices

1. **State Consistency**: Always update both task state and session state together
2. **Transition Validation**: Validate state transitions before applying
3. **Event Logging**: Log state transitions in `task_lifecycle_events`
4. **Error Recovery**: Handle failed transitions gracefully
5. **Real-time Updates**: Use WebSocket for immediate state updates

## Future Enhancements

1. **PR Auto-Creation**: Automatically create PR when commits reach threshold
2. **Review Integration**: Track PR review status and comments
3. **CI/CD Status**: Include build/test status in state machine
4. **Dependency Tracking**: Handle inter-task dependencies
5. **State Webhooks**: External notifications on state changes