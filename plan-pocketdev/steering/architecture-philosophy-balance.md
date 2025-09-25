# Architecture Philosophy: A Balanced Approach

<!-- Document Metadata
Created: 2025-09-14
Modified: 2025-09-14
Status: active
-->


## Core Insight

Ousterhout's "Philosophy of Software Design" principles are powerful tools, but they should be applied **where they make sense**, not universally. Different architectural patterns serve different purposes.

## Pattern Selection Guide

### Use Deep Modules When You Have:

**Complex Implementation Details**
- Git operations (merge algorithms, conflict detection) — e.g. the orchestration in `backend/services/task.service.js:279`
- Database queries (SQL construction, connection pooling) — see the persistence helpers in `backend/services/internal/task-repository.js:7`
- External API integration (retry logic, error handling) — Shelltender calls live in `backend/services/terminal.service.js:149`
- System operations (process management, file system operations) — worktree cleanup is handled by `backend/services/worktree.service.js`

**Example**: `backend/services/git.service.js`
```javascript
// Simple interface
async merge(sourceBranch, targetBranch)

// Hides complex implementation:
// - Worktree management
// - Three-way merge algorithms
// - Conflict detection
// - Command construction
// - Error recovery
```

### Use Feature Modules When You Have:

**Coordination & Workflow Logic**
- UI state management (which tab is active?) — `frontend/src/features/terminal-tabs.ts`
- Layout calculations (can we show 4 terminals?) — `frontend/src/features/split-view.ts`
- Event orchestration (user clicked X, update Y and Z)

**Example**: `frontend/src/features/split-view.ts`
```typescript
// Wide interface is OK - it's mostly coordination
export interface SplitViewFeature {
  layout: LayoutConfig
  constraints: LayoutConstraints
  setMode(): void
  cycleLayout(): void
  // ... etc
}

// The "complexity" is just workflow:
// - If window < 600px, use tab mode
// - If user drags divider, update ratio
// - If terminal added, recalculate layout
```

## The Key Question

When designing a module, ask: **"Am I hiding complexity or just moving it?"**

- **Hiding complexity** → Deep module pattern ✅
- **Just moving it** → Feature module with transparency ✅

## Examples in PocketDev

### Deep Modules (Genuine Complexity)
- `backend/services/git.service.js` - Complex git operations
- `backend/services/internal/project-repository.js` - SQL and transactions
- `backend/services/terminal.service.js` - WebSocket management, session state
- `backend/services/github-token.service.js` - Token management, encryption

### Feature Modules (Coordination/Workflow)
- `frontend/src/features/terminal-tabs.ts` - Tab management workflow
- `frontend/src/features/split-view.ts` - Layout coordination

### React Components (UI Patterns)
- `TerminalPanel.tsx` - Orchestration component
- `DirectTerminal.tsx` - Terminal rendering
- `TaskCard.tsx` - Presentation component

## Why This Matters for AI Collaboration

AI assistants benefit from:
1. **Complete context** when modifying workflows (feature modules)
2. **Clean interfaces** when using complex services (deep modules)
3. **Predictable patterns** that match the problem domain

## Anti-Pattern: Mismatched Patterns

❌ **Deep module for simple coordination**
```typescript
class LayoutManager {
  private mode: string
  private terminals: Terminal[]
  
  // Why hide this? It's just:
  getVisibleTerminals() {
    return this.mode === 'tab' ? [this.terminals[0]] : this.terminals
  }
}
```

❌ **Feature module for complex algorithms**
```typescript
// 500 lines of merge conflict detection exposed in UI feature
export function detectConflicts(tree1, tree2) {
  // Complex tree traversal algorithms that should be hidden
}
```

## The Bottom Line

**Match the pattern to the problem:**
- Complex implementation → Hide it (deep module)
- Coordination logic → Show it (feature module)
- UI rendering → Component patterns

This isn't about theoretical purity - it's about making code that's maintainable by both humans and AI assistants.
