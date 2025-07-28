# Tab Persistence Fix Summary

## Problem
Tab persistence was not working despite multiple attempts to fix it. Investigation revealed:
- Tasks had accumulated 40+ terminal sessions (task 1dcbda95 had 41!)
- Tab selection wasn't persisting across page reloads
- Complex React logic with multiple useEffects caused race conditions
- Frontend was creating sessions instead of just displaying backend data

## Solution Implemented
1. **Reverted problematic commits** that added complex state management
2. **Simplified TerminalPanel** to a basic load-display-remember pattern
3. **Backend owns all data** - frontend is purely a display layer
4. **Added terminal limits** - max 6 terminals per task enforced in backend
5. **Fixed localStorage** - simple save on select, restore on load

## Key Changes

### Frontend (TerminalPanel.tsx)
```typescript
// Before: Complex with multiple useEffects and state
const [terminals, setTerminals] = useState<TerminalSession[]>([]);
const [activeTabId, setActiveTabId] = useState<string>('');
// ... multiple complex useEffects

// After: Simple and predictable
const [activeTabId, setActiveTabId] = useState(() => {
  return localStorage.getItem(`activeTab-${task.id}`) || '';
});

// Single validation effect
useEffect(() => {
  if (task.terminals?.length > 0) {
    const savedId = localStorage.getItem(`activeTab-${task.id}`);
    const validTab = task.terminals.find(t => t.dbSessionId === savedId);
    if (!validTab && task.terminals[0]) {
      setActiveTabId(task.terminals[0].dbSessionId);
    }
  }
}, [task.id, task.terminals]);
```

### Backend (terminal.controller.js)
```javascript
// Check terminal limit before creating
const currentTerminals = await models.sessions.findAllActiveByTaskId(taskId);
if (currentTerminals.length >= 6) {
  return res.status(400).json({ 
    error: 'Maximum number of terminals (6) reached for this task',
    currentCount: currentTerminals.length
  });
}
```

### Backend (task.controller.js)
```javascript
// Limit returned terminals to 6
const allTerminals = await this.models.sessions.findAllActiveByTaskId(taskId);
const terminals = allTerminals.slice(0, 6);

if (allTerminals.length > 6) {
  console.warn(`Task ${taskId} has ${allTerminals.length} terminals - showing only first 6`);
}
```

## Results
- Tab persistence now works reliably
- No new sessions created on page reload
- Maximum 6 terminals enforced
- Clean, maintainable code
- TypeScript compilation passes

## Testing Checklist
- [x] Create task with 3 tabs
- [x] Select middle tab
- [x] Refresh page → middle tab still selected
- [x] Navigate away and back → middle tab still selected
- [x] Try to create 7th tab → error message
- [x] Check database → only expected terminals exist

## Lessons Learned
1. **Keep it simple** - Complex React state management often causes more problems than it solves
2. **Backend owns data** - Frontend should just display, not manage complex state
3. **Limit resources** - Always enforce limits to prevent resource exhaustion
4. **Test the simple case first** - Basic localStorage often works better than complex solutions