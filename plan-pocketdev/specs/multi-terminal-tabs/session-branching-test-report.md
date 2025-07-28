# Claude Session Branching/Forking Test Report

## Test Objectives

Test whether Claude sessions can be effectively "branched" to create parallel conversation threads while maintaining the original context, similar to git branching for code.

## Test Plan

### Test 1: Basic Continue Functionality
```bash
# Terminal 1: Start original session
claude "Help me implement a user authentication system"
# Work on implementation...
# Note the session ID from claude

# Terminal 2: Continue same session
claude --continue
# or
claude -c
```

### Test 2: Resume with Session ID
```bash
# Terminal 1: Original session
claude "Help me implement a user authentication system"
# Get session ID (need to parse from Claude output or file system)

# Terminal 2: Resume specific session
claude --resume <session-id>
# or
claude -r <session-id>
```

### Test 3: Concurrent Access
```bash
# Test running same session in multiple terminals simultaneously
# Terminal 1: Active Claude session
# Terminal 2: Attempt to resume while Terminal 1 is active
```

### Test 4: Branching Behavior
```bash
# Terminal 1: Original session working on main task
# Terminal 2: Resume session, ask different question
# Return to Terminal 1: Check if context is affected
```

## Expected Results

### Capabilities

1. **Session Continuation Works**
   - `claude --continue` successfully loads most recent session
   - Full conversation history is available
   - Can continue from where left off

2. **Session ID Resume**
   - `claude -r <session-id>` loads specific session
   - Historical sessions can be resumed
   - Context fully restored

3. **Parallel Conversations**
   - Multiple terminals can load same session history
   - Each creates independent conversation branch
   - Original session unaffected by branches

### Implementation Strategy

```typescript
interface SessionBranch {
  originalSessionId: string;
  branchSessionId: string;
  branchPoint: number; // message index where branch occurred
  tabId: string;
  purpose: string; // "side investigation", "alternative approach", etc.
}

// Workflow:
// 1. User right-clicks tab → "Branch Session"
// 2. System creates new tab
// 3. Launch claude with: claude -r <original-session-id>
// 4. Track as branch in database
```

## Limitations

1. **No True Forking**
   - Claude doesn't support git-like branching natively
   - Each resumed session continues independently
   - No merge capability back to original

2. **Session ID Discovery**
   - Claude doesn't output session ID directly
   - Need to parse from logs or file system
   - May need Claude SDK for reliable ID access

3. **State Synchronization**
   - Branches don't share new knowledge
   - Each branch has its own token usage
   - No way to sync learnings between branches

4. **Storage Considerations**
   - Each branch maintains full history
   - Could lead to significant storage usage
   - No deduplication of shared history

## Risks

1. **User Confusion**
   - Multiple similar sessions could be confusing
   - Need clear visual indicators for branches
   - Risk of working in wrong session

2. **Context Drift**
   - Branches may develop different understanding
   - Conflicting advice between branches
   - No way to reconcile differences

3. **Cost Multiplication**
   - Each branch incurs full token costs
   - Shared context still charged per branch
   - Could significantly increase API usage

4. **Technical Complexity**
   - Managing multiple Claude processes
   - Tracking parent-child relationships
   - Handling branch lifecycle

## Recommendations

### Implement Basic Branching
1. **Add "Branch Session" context menu to tabs**
2. **Create new tab with branched indicator**
3. **Launch with `claude -r <session-id>`**
4. **Track relationship in database**

### Visual Design
```
[Main Implementation] [📋 Branch: Side Investigation] [📋 Branch: Alternative]
      (blue)                    (blue + icon)                (blue + icon)
```

### Database Schema
```sql
ALTER TABLE terminal_sessions ADD COLUMN parent_session_id VARCHAR(255);
ALTER TABLE terminal_sessions ADD COLUMN branch_purpose VARCHAR(255);
ALTER TABLE terminal_sessions ADD COLUMN is_branch BOOLEAN DEFAULT FALSE;
```

### User Workflow
1. Working in main session
2. Right-click tab → "Create Branch for Side Investigation"
3. New tab opens with full context
4. Work independently in branch
5. Optional: Copy findings back to main session manually

## Conclusion

Session branching is technically feasible using Claude's continue/resume functionality. While not true git-like branching, it provides value for parallel investigations. Recommend implementing as an advanced feature after basic multi-tab support is stable.

**Verdict**: Include in Phase 6 as "experimental feature" with clear limitations documented.