# /create-claude-guide

<!-- Document Metadata
Created: 2025-07-11
Modified: 2025-07-11
Status: ????
-->


Generate implementation guides optimized for Claude Code execution. These guides enable Claude to manage complex processes autonomously with clear decision points and progress tracking.

## Usage

```
/create-claude-guide <type> <topic> [--style technical|structured]
```

## Parameters

- `<type>`: The type of guide to create
  - `implementation` - Step-by-step implementation guide
  - `upgrade` - Version upgrade guide  
  - `migration` - Complex system migration guide
  - `release` - Release process documentation
  - `troubleshooting` - Diagnostic and problem-solving guide

- `<topic>`: The subject of the guide (e.g., "codebase-separation", "npm-publishing")

- `--style`: Documentation style (default: technical)
  - `technical` - Minimal prose, maximum precision
  - `structured` - More context with clear structure

## CRITICAL: Execution Context

**Claude Code executes commands programmatically. Users DO NOT see real-time output.**

### ❌ AVOID:
```bash
echo "=== Starting process ==="
echo "Checking dependencies..."
echo "✓ Step 1 complete"
```

### ✅ PREFER:
```bash
# Use TodoWrite for visible progress
# TodoWrite: Mark Step 1 as in_progress

# Silent operations with result capture
DEPS_MISSING=""
for dep in git npm docker; do
  command -v $dep >/dev/null || DEPS_MISSING="$DEPS_MISSING $dep"
done

# Report only actionable results
[ -n "$DEPS_MISSING" ] && echo "Missing dependencies: $DEPS_MISSING"
```

## Required Guide Structure

### 1. Pre-Flight Summary
```markdown
## Pre-Flight [Task] Summary

Before starting, Claude should output:
- Current state: [concise description]
- Target state: [concise description]
- Estimated time: ~X-Y minutes
- Known risks: [top 3]
```

### 2. TodoWrite Integration
```markdown
## Claude Tool Usage Pattern

1. **Start with TodoWrite** - Create these N steps IMMEDIATELY:
   - Step 1: [Action]
   - Step 2: [Action]
   
**Progress Tracking:**
- Update to "in_progress" BEFORE each step
- Mark "completed" IMMEDIATELY after
- Add new todos for any issues discovered
```

### 3. State Management
```typescript
const guideState = {
  CURRENT_STEP: 0,
  CRITICAL_VALUES: {},     // Capture important values
  ERRORS: [],              // Track failures
  ROLLBACK_POINTS: []      // For recovery
};
```

### 4. Decision Matrix
```markdown
## Decision Matrix

| Check | Command | Result | Action |
|-------|---------|--------|---------|
| File exists? | `test -f config.json` | No | Create with defaults |
| Service running? | `pgrep node` | Yes | Stop before proceeding |
| Permissions OK? | `[ -w ./data ]` | No | Ask: "Need write permissions" |
```

### 5. Error Templates
```markdown
## Error Response Templates

### [Error Type]:
"I encountered [specific issue]: [details]
This is likely because [reason].
To fix: [exact command or action]
Should I [specific next step]?"
```

### 6. Success Checkpoints
```markdown
## Success Checkpoints
- Step 1: ✓ [Specific verifiable outcome]
- Step 2: ✓ [Next verifiable outcome]
```

### 7. Completion Summary
```markdown
## Completion Summary

🎉 **[Task] completed successfully!**

Results:
- [Key outcome 1]
- [Key outcome 2]

Next: [Immediate action for user]
```

## Best Practices

### 1. Progress Visibility
- **Primary**: Use TodoWrite for all progress tracking
- **Secondary**: Capture values in variables
- **Avoid**: Echo statements for progress

### 2. Batch Operations
```bash
# Good: Collect all results, report once
RESULTS=""
for file in *.json; do
  # Process silently
  process_file "$file" && RESULTS="$RESULTS $file:OK" || RESULTS="$RESULTS $file:FAIL"
done
echo "Processing complete: $RESULTS"
```

### 3. Decision Points
- Every decision must have explicit criteria
- Use exit codes, not string parsing
- Always provide exact next actions

### 4. State Tracking
- Capture critical values early
- Update state variables consistently
- Use state for recovery procedures

## Examples

```
/create-claude-guide implementation authentication-system
/create-claude-guide migration monorepo-split --style structured
/create-claude-guide release npm-package
/create-claude-guide troubleshooting connection-errors
```

## Quality Checklist

Before finalizing:
- [ ] TodoWrite is primary progress mechanism
- [ ] Minimal echo statements (only for results/errors)
- [ ] All decisions have explicit criteria
- [ ] Error messages include exact fixes
- [ ] State tracking enables recovery
- [ ] Commands are silent with result capture
- [ ] Success is clearly verifiable

## Related Commands

- `/create-human-guide` - For human-readable documentation
- `/create-guide` - Original combined command (deprecated)