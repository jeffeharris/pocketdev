# Tab Persistence Flow Analysis

## Expected Flow:
1. **Tab Selection**: User clicks tab → `handleTabSelect` → `setActiveTabId` → localStorage saves
2. **Page Reload**: 
   - TaskWorkspace mounts → loads tasks (without terminals)
   - TerminalPanel mounts → task.terminals is undefined
   - TaskWorkspace calls `loadTaskDetails` → fetches terminals
   - TerminalPanel re-renders with terminals → attempts restore

## Potential Issues:

### 1. Task ID Mismatch
- localStorage key uses `task.id`
- Is task.id consistent across reloads?

### 2. Timing Issues
- TerminalPanel might render multiple times
- activeTabId might be set before restoration

### 3. Terminal ID Changes
- Are dbSessionIds stable across reloads?
- Might be creating new sessions instead of reusing

## Debug Points Needed:
1. What's in localStorage?
2. What task.id is being used?
3. Are terminal dbSessionIds matching?
4. Is restoration code even running?
5. Is activeTabId being overwritten after restore?