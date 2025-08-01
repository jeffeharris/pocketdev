# Focus Management Fix - dbSessionId Consistency

**Date**: 2025-07-29
**Issue**: Focus indicator not showing despite clicks being detected

## Root Cause

The terminalStore was inconsistent in its use of terminal identifiers:
- Map keys were using `terminal.sessionId`  
- Lookups were using `dbSessionId`
- This mismatch caused all terminal lookups to fail

## Fix Applied

Updated terminalStore to use `dbSessionId` consistently throughout:

1. **Map Storage**:
   ```typescript
   // Before:
   taskTerminals.set(terminal.sessionId, terminal);
   
   // After:
   taskTerminals.set(terminal.dbSessionId, terminal);
   ```

2. **Method Signatures**:
   - `updateTerminal(taskId, dbSessionId, updates)`
   - `removeTerminal(taskId, dbSessionId)`
   - `updateTerminalState(taskId, dbSessionId, aiState)`
   - `renameTerminal(taskId, dbSessionId, newName)`
   - `getTerminal(taskId, dbSessionId)`
   - `registerDisposal(dbSessionId, callback)`
   - `disposeTerminal(dbSessionId)`

3. **WebSocket Event Handlers**:
   - Updated to pass `data.dbSessionId` instead of `data.sessionId`

4. **Component Updates**:
   - Fixed TerminalPanel to use `dbSessionId` in updateTerminal calls

## Result

Focus indicators now work correctly:
- Clicking a terminal sets focus (blue ring)
- Unfocused terminals show gray ring
- Focus state properly tracked in store
- Visual feedback immediate and accurate

## Lessons Learned

1. **Consistency is Key**: Always use the same identifier throughout a system
2. **Debug Systematically**: Console logs revealed the exact mismatch
3. **Type Safety**: TypeScript didn't catch this because both were strings
4. **Store Design**: Consider using a single canonical ID to avoid confusion