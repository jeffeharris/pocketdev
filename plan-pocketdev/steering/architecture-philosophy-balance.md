# Architecture Philosophy: A Balanced Approach

## Core Insight

Ousterhout's "Philosophy of Software Design" principles are powerful tools, but they should be applied **where they make sense**, not universally. Different architectural patterns serve different purposes.

## Pattern Selection Guide

### Use Deep Modules When You Have:

**Complex Implementation Details**
- Git operations (merge algorithms, conflict detection)
- Database queries (SQL construction, connection pooling)
- External API integration (retry logic, error handling)
- System operations (process management, file system operations)

**Example**: GitService
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
- UI state management (which tab is active?)
- Layout calculations (can we show 4 terminals?)
- Business rules (when can a task be merged?)
- Event orchestration (user clicked X, update Y and Z)

**Example**: split-view.ts
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
- `GitService` - Complex git operations
- `DatabaseService` - SQL and transactions
- `TerminalService` - WebSocket management, session state
- `AuthService` - Token management, encryption

### Feature Modules (Coordination/Workflow)
- `terminal-tabs.ts` - Tab management workflow
- `split-view.ts` - Layout coordination
- `task-creation.ts` - Multi-step creation flow
- `session-management.ts` - Session lifecycle

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