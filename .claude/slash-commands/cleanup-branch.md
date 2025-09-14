# /cleanup-branch

<!-- Document Metadata
Created: 2025-07-08
Modified: 2025-07-08
Status: ????
-->


Clean up the current branch by removing debug code, updating documentation, and organizing commits logically.

## Usage
```
/cleanup-branch [--scope all|debug|docs|commits] [--branch branch-name]
```

## Examples
- `/cleanup-branch` - Full cleanup of current branch
- `/cleanup-branch --scope debug` - Only remove debug code
- `/cleanup-branch --scope docs` - Only update documentation
- `/cleanup-branch --branch feat/new-feature` - Cleanup specific branch

## What This Command Does

### 1. Identify Debug/Temporary Code
I will search for and remove:
- Console.log statements with debug prefixes
- TODO comments marked as temporary
- Commented-out code blocks
- Debug-specific imports or variables
- Test data or mock implementations

### 2. Update Documentation
I will:
- Update relevant .md files with latest changes
- Create/update CHANGELOG entries
- Ensure all docs reflect current implementation
- Remove outdated documentation sections

### 3. Organize Commits
I will create logical commit groups:
- Group related changes together
- Use conventional commit format
- Create separate commits for:
  - Feature implementation
  - Documentation updates
  - Code cleanup
  - Test additions/updates

## Claude's Cleanup Process

### Phase 1: Analysis
```typescript
const cleanupState = {
  BRANCH: "current",
  DEBUG_PATTERNS: [
    "console.log.*Debug",
    "console.trace",
    "// DEBUG:",
    "// TODO: Remove",
    "// TEMP:",
    "refHistoryRef", // tracking debug state
  ],
  FILES_TO_CHECK: [],
  CHANGES_TO_MAKE: {
    debug_removals: [],
    doc_updates: [],
    code_improvements: []
  }
};
```

### Phase 2: Decision Tree

```
START
│
├─> Check current git status
│   └─> Are there uncommitted changes?
│       ├─> YES: Stash or handle appropriately
│       └─> NO: Continue
│
├─> Scan for debug code
│   ├─> Found debug patterns?
│   │   ├─> YES: Add to removal list
│   │   └─> NO: Skip
│   └─> Check each file
│
├─> Review documentation needs
│   ├─> CHANGELOG exists?
│   │   ├─> NO: Create one
│   │   └─> YES: Update it
│   └─> Other docs need updates?
│
└─> Organize commits
    ├─> Group by type
    ├─> Create meaningful messages
    └─> Commit in logical order
```

### Phase 3: Implementation Checklist

- [ ] Run `git status` to understand current state
- [ ] Search for debug patterns using grep/ripgrep
- [ ] Review each file with debug code
- [ ] Remove only Claude-added debug code
- [ ] Update documentation files
- [ ] Create/update CHANGELOG
- [ ] Stage changes in logical groups
- [ ] Create descriptive commits

## What Claude Will Ask Before Major Changes

If I encounter situations requiring decisions:

1. **Mixed Changes**: "I found both debug code and feature code in the same file. Should I create separate commits?"
2. **User Debug Code**: "This debug code doesn't match my patterns. Did you add this? Should I keep it?"
3. **Breaking Changes**: "Removing this code might affect functionality. Should I proceed?"
4. **Documentation Gaps**: "I noticed these features aren't documented. Should I add documentation?"

## Example Cleanup Session

```bash
# 1. Check current state
git status
git diff

# 2. Search for debug code
rg "console\.(log|trace|debug)" --type ts --type tsx
rg "// (DEBUG|TODO: Remove|TEMP):" --type ts

# 3. Remove debug code file by file
# (I'll use Edit tool to remove specific lines)

# 4. Update documentation
# - Update CHANGELOG.md
# - Update relevant feature docs
# - Remove temporary documentation

# 5. Commit in logical groups
git add -p  # Stage changes selectively

# Commit 1: Remove debug code
git commit -m "chore: Remove debug logging and temporary code"

# Commit 2: Update documentation
git commit -m "docs: Update Shelltender implementation guides"

# Commit 3: Code improvements
git commit -m "refactor: Simplify Terminal ref handling"
```

## Safety Guidelines

1. **Never remove code I'm uncertain about** - I'll ask first
2. **Preserve all user-added code** - Only remove my temporary additions
3. **Keep commits atomic** - Each commit should have one clear purpose
4. **Document what was removed** - Note significant removals in commit messages
5. **Test after cleanup** - Ensure nothing is broken

## Common Patterns I Look For

### Debug Console Logs
```typescript
console.log('[DirectTerminal Debug]', ...);  // Remove
console.trace('[Component] Stack trace');     // Remove
console.log('User data:', data);             // Ask first
```

### Temporary Comments
```typescript
// DEBUG: Testing ref behavior              // Remove
// TODO: Remove after v0.4.4 upgrade       // Check version first
// TEMP: Workaround for bug                // Keep with explanation
```

### Test/Mock Data
```typescript
const TEST_DATA = { ... };                 // Remove if unused
const mockResponse = { ... };              // Remove if not needed
```

## Output Format

After cleanup, I'll provide:
1. Summary of changes made
2. List of commits created
3. Any decisions that need review
4. Suggestions for future improvements

## Best Practices

- Clean up promptly after feature completion
- Don't let debug code accumulate
- Keep documentation in sync with code
- Use meaningful commit messages
- Group related changes together

Remember: A clean codebase is a happy codebase! 🧹