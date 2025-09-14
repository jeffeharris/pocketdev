# AI-Assisted Development Architecture Guide

## Core Principle

**"One concept, one file, complete implementation"**

When developing with AI assistance, the architecture should optimize for AI comprehension and modification. This differs from traditional human-only development patterns.

## Key Insights from Refactoring

### What Works for AI + Human Collaboration

1. **Self-contained modules** - AI can understand and modify a 500-line file better than five 100-line files scattered across directories
2. **Clear boundaries** - Each module should have a single, clear responsibility that AI can reason about
3. **Consistent patterns** - When patterns repeat, AI learns and applies them correctly
4. **Complete context** - Minimize cross-file dependencies so AI doesn't lose context

### What Doesn't Work

1. **Over-abstraction** - Three layers of indirection confuses both AI and humans
2. **Scattered logic** - Tab logic in 10 different files makes it hard for AI to understand the complete picture
3. **Too many small files** - AI context windows get consumed by boilerplate and imports
4. **Complex dependency graphs** - AI struggles to trace through multiple layers of inheritance/composition

## Architectural Patterns by Use Case

### ✅ Use Ousterhout's Deep Modules For:

**Services & Domain Logic**
```typescript
// GOOD: Deep module with simple interface
class GitService {
  async merge(branch1: string, branch2: string): Promise<MergeResult>
  async getConflicts(branch: string): Promise<Conflict[]>
  // Hides: git commands, worktree management, conflict detection algorithms
}
```

**Utilities & Algorithms**
```typescript
// GOOD: Complex implementation behind simple interface
export function detectMergeConflicts(tree1: GitTree, tree2: GitTree): Conflict[]
// Hides: tree traversal, diff algorithms, conflict resolution logic
```

**State Management**
```typescript
// GOOD: Store with minimal public API
const useTerminalStore = create(() => ({
  getState(taskId): State
  updateTerminal(taskId, action): void
  // Hides: normalization, persistence, subscriptions
}))
```

### ✅ Use React Patterns For:

**UI Components**
```typescript
// GOOD: Compound components for flexibility
<Terminal>
  <Terminal.Header />
  <Terminal.Body />
  <Terminal.Footer />
</Terminal>
```

**Presentational Logic**
```typescript
// GOOD: Separate container and presentation
TerminalContainer.tsx   // Logic, state, effects
TerminalView.tsx       // Pure rendering
```

### ✅ Use Feature Modules For:

**Complete Domain Areas**
```typescript
// GOOD: All related logic in one place
features/
  terminalTabs.ts      // ALL tab logic (500 lines is fine!)
  terminalLayout.ts    // ALL layout logic
  terminalSessions.ts  // ALL session management
```

## Recommended Project Structure for AI Collaboration

```
src/
  features/           # Self-contained feature modules (AI-friendly)
    terminal/
      tabs.ts        # Complete tab implementation
      layout.ts      # Complete layout implementation
      sessions.ts    # Complete session management
      
  services/          # Deep modules for domain logic
    git.service.ts   # All git operations
    api.service.ts   # All API operations
    
  components/        # UI components (React patterns)
    terminal/
      TerminalPanel.tsx      # Orchestration
      TerminalView.tsx       # Presentation
      
  types/            # Shared type definitions
    terminal.types.ts
```

## Anti-Patterns to Avoid

### ❌ Over-Abstraction
```typescript
// BAD: Too many layers
TerminalPanel → Orchestrator → Service → Repository → API
// GOOD: Direct and clear
TerminalPanel → TerminalService → API
```

### ❌ Scattered Features
```typescript
// BAD: Tab logic across many files
TabContext.tsx
TabReducer.ts
TabActions.ts
TabSelectors.ts
TabEffects.ts
TabTypes.ts

// GOOD: One file
tabs.ts  // Everything about tabs
```

### ❌ Premature Optimization
```typescript
// BAD: Creating abstractions for single use
interface TabActionHandler {
  handle(action: TabAction): void
}

// GOOD: Direct implementation
function handleTabAction(action: TabAction) { }
```

## Practical Guidelines

### When to Split Files

Split when:
- Two concepts are genuinely unrelated
- File exceeds 1000 lines AND has multiple responsibilities
- You need different access patterns (public vs internal)

Don't split when:
- Logic is related (keep tab creation with tab deletion)
- You're just following arbitrary size limits
- It would require complex coordination between files

### When to Create Abstractions

Create abstractions when:
- You have 3+ implementations of the same pattern
- The abstraction genuinely hides complexity
- It makes the code easier for AI to understand

Don't abstract when:
- You have only one implementation
- The abstraction is as complex as the implementation
- It's just indirection without benefit

### Service Layer Design

```typescript
// Pattern for AI-friendly services
export class FeatureService {
  private state: ServiceState;
  
  // Simple, predictable public API
  async operation(params: Params): Promise<Result<Data>> {
    try {
      // All logic contained here
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
```

## Measuring Success

Your architecture is AI-friendly when:
1. AI can understand a complete feature by reading one file
2. Patterns are consistent across the codebase
3. Dependencies are minimal and explicit
4. Each module has a clear, single purpose
5. The interface is simpler than the implementation

## Key Takeaway

**For AI-assisted development, optimize for clarity and completeness over theoretical purity.**

- A 500-line file with complete feature implementation > 10 files with perfect separation
- Clear patterns > clever abstractions
- Self-contained modules > complex dependency graphs
- Consistent structure > varied architectural styles

The goal is to make it easy for both you and AI to understand, modify, and extend the code. Sometimes this means accepting larger files and fewer abstractions than traditional software engineering would recommend.