# Task: Simplified Tab Persistence Implementation

<!-- Document Metadata
Created: 2025-07-28
Modified: 2025-07-28
Status: ????
-->


## Problem Statement

The current implementation of tab persistence is overcomplicated and not working. Despite multiple attempts to fix it, we have:
- Tasks with 38+ terminal sessions (massive session leak)
- Tab persistence that doesn't work on page reload
- Race conditions between multiple useEffects
- Overly complex state management

## Root Cause

The implementation tried to do too much in the frontend:
- Creating sessions in React components
- Managing complex state across multiple useEffects
- Fighting between localStorage, database state, and component state
- No clear separation between data loading and UI state

## Proposed Solution

Implement a simplified approach where:
1. Backend is the single source of truth for terminals
2. Frontend just displays what's in the database
3. localStorage only stores the active tab ID
4. No session creation in the frontend components

## Implementation Steps

### Step 1: Revert Complex Frontend Logic
**Files to modify:**
- `frontend/src/components/terminal/TerminalPanel.tsx`

**Changes:**
- Remove all the complex useEffect chains
- Remove session creation logic
- Remove hasRestoredTab ref and other unnecessary state
- Simplify to basic load → display → remember pattern

### Step 2: Fix Backend to Prevent Session Proliferation
**Files to modify:**
- `backend/controllers/task.controller.js`

**Changes:**
- When loading a task, include only active terminal sessions
- Limit to maximum 6 terminals per task
- Ensure proper cleanup of old sessions

### Step 3: Implement Simple Tab Component

```typescript
// Simplified TerminalPanel
const TerminalPanel = ({ task }) => {
  const [activeTabId, setActiveTabId] = useState(() => {
    return localStorage.getItem(`activeTab-${task.id}`) || '';
  });

  // Simple effect - just validate the saved tab exists
  useEffect(() => {
    if (task.terminals?.length > 0) {
      const savedId = localStorage.getItem(`activeTab-${task.id}`);
      const validTab = task.terminals.find(t => t.dbSessionId === savedId);
      
      if (!validTab && task.terminals[0]) {
        setActiveTabId(task.terminals[0].dbSessionId);
      }
    }
  }, [task.id, task.terminals]);

  // Save when active tab changes
  const handleTabSelect = (tabId) => {
    setActiveTabId(tabId);
    localStorage.setItem(`activeTab-${task.id}`, tabId);
  };

  // That's it! No complex state management
  return (
    <>
      <TerminalTabs 
        tabs={task.terminals || []}
        activeTabId={activeTabId}
        onTabSelect={handleTabSelect}
      />
      {task.terminals?.map(terminal => (
        <DirectTerminal
          key={terminal.dbSessionId}
          visible={terminal.dbSessionId === activeTabId}
          {...terminal}
        />
      ))}
    </>
  );
};
```

### Step 4: Ensure Terminals Load with Task

**Files to modify:**
- `backend/controllers/task.controller.js` - getTask method

**Changes:**
- Always include terminals when fetching a task
- Limit to 6 most recent terminals
- Mark older terminals as inactive

### Step 5: Fix Session Creation

**Current problem:** New sessions created on every page load

**Solution:**
- Move ALL session creation to explicit user actions (clicking + button)
- Never auto-create sessions in component lifecycle
- Backend should return empty array if no terminals exist

## Commits to Revert

Based on the git history, these commits added complexity without solving the core issue:

1. `42d9f34` - fix: handle tasks with excessive terminals... 
2. `0b1fc0d` - fix: improve tab persistence with better state management
3. `9fd9bb5` - fix: tab persistence not working properly

Consider reverting to before these "fixes" and implementing the simple solution.

## Success Criteria

1. **No session proliferation** - Task should never have more than 6 active terminals
2. **Tab persistence works** - Refresh page, same tab is selected
3. **Simple code** - Under 50 lines of code in TerminalPanel for tab management
4. **No race conditions** - Single useEffect, clear data flow
5. **Backend owns data** - Frontend just displays

## Testing

1. Create task with 3 tabs
2. Select middle tab
3. Refresh page → middle tab still selected
4. Navigate away and back → middle tab still selected
5. Check database → only 3 terminals exist (not 30+)

## Estimated Time

- 2 hours to implement
- 1 hour to test
- Total: 3 hours

## Alternative: Full Revert

If the above seems too complex given the current state, consider:
```bash
git reset --hard b0565f4  # Before "tab persistence" commits
```

Then implement the simple version from scratch with the lessons learned.