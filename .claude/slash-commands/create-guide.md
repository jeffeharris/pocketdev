# /create-guide

Generate comprehensive documentation, implementation guides, and instructions optimized for clarity and actionability. Creates guides that can be effectively used by both human developers and Claude instances.

## Usage

```
/create-guide <type> <topic> [--for claude|human|both] [--style technical|tutorial|reference]
```

## Parameters

- `<type>`: The type of guide to create
  - `implementation` - Step-by-step implementation guide
  - `upgrade` - Version upgrade or migration guide  
  - `troubleshooting` - Diagnostic and problem-solving guide
  - `api` - API reference documentation
  - `architecture` - System design and architecture docs
  - `quickstart` - Getting started guide
  - `release` - Release process documentation

- `<topic>`: The subject of the guide (e.g., "shelltender-v0.4.1", "authentication-system")

- `--for`: Target audience (default: both)
  - `claude` - Optimized for Claude execution with decision trees and exact commands
  - `human` - Human-readable with explanations and context
  - `both` - Dual-format with sections for each audience

- `--style`: Documentation style (default: technical)
  - `technical` - Precise, command-focused, minimal prose
  - `tutorial` - Educational with explanations and examples
  - `reference` - Structured reference with quick lookup

## Examples

```
/create-guide implementation terminal-focus --for claude
/create-guide upgrade react-19-migration --for both
/create-guide troubleshooting websocket-connections --style tutorial
/create-guide release npm-package-publishing --for claude --style technical
```

## Guide Structure Templates

### For Claude-Optimized Guides

1. **Pre-execution Environment Check**
   - Exact commands to verify prerequisites
   - Clear checklist format
   - State tracking initialization

2. **Tool Usage Patterns**
   - TodoWrite structure with exact steps
   - Read-before-edit requirements
   - Parallel operation opportunities

3. **Decision Trees**
   - Explicit if/then logic
   - Error-to-action mappings
   - No ambiguous choices

4. **State Management**
   - Variable tracking templates
   - Progress indicators
   - Rollback checkpoints

5. **Communication Templates**
   - Exact phrases for different scenarios
   - When to ask vs. proceed
   - Error reporting formats

### For Human-Optimized Guides

1. **Overview**
   - Purpose and goals
   - Key benefits
   - Prerequisites

2. **Step-by-Step Instructions**
   - Numbered steps with clear actions
   - Visual indicators (✅ ❌ ⚠️)
   - Tips and warnings

3. **Code Examples**
   - Complete, runnable examples
   - Before/after comparisons
   - Common variations

4. **Troubleshooting**
   - Common issues and solutions
   - Debug strategies
   - Where to get help

## Output Format Guidelines

### Claude-Optimized Sections

```markdown
## Claude Must NEVER
- Absolute prohibitions with no exceptions
- Clear consequences stated

## Decision Framework
\`\`\`
Situation
├─ Condition A?
│  └─ YES → Specific action with exact command
├─ Condition B?
│  └─ YES → Different action with reasoning
└─ Otherwise → Default safe action
\`\`\`

## State Tracking
\`\`\`typescript
const guideState = {
  CURRENT_STEP: 1,
  TOTAL_STEPS: 10,
  VERSION_FROM: "",
  VERSION_TO: "",
  ERRORS: [],
  COMPLETED_ACTIONS: []
};
\`\`\`

## Exact Commands
\`\`\`bash
# One-line status check
echo "Status: $(command1) | $(command2)"

# Parallel operations
npm install & npm run build & wait

# Quick verification
echo "Version: $(grep '@package' package.json | cut -d'"' -f4)"
\`\`\`
```

### Human-Optimized Sections

```markdown
## Overview
Brief description of what this guide covers and why it's useful.

## Prerequisites
- [ ] Required tool version X.Y.Z
- [ ] Access to specific services
- [ ] Understanding of concepts

## Implementation Steps

### 1. Step Name
Clear description of what this step accomplishes.

\`\`\`bash
# Command with explanation
command --with-flags  # What this does
\`\`\`

**Expected output:**
\`\`\`
Success message or example output
\`\`\`

💡 **Tip:** Helpful context or alternative approach

⚠️ **Warning:** Common pitfall to avoid
```

## Best Practices

1. **Use Clear Section Headers**
   - Claude sections: "Claude Tool Usage Pattern", "Claude Must NEVER"
   - Human sections: "Getting Started", "Common Issues"

2. **Include Success Criteria**
   - Explicit checks for Claude to verify
   - Visual confirmation for humans

3. **Provide Recovery Procedures**
   - Rollback steps for every major action
   - Clear error handling paths

4. **Add Contextual Information**
   - Why certain decisions are made
   - Trade-offs and alternatives
   - Links to related documentation

5. **Use Consistent Formatting**
   - Code blocks with language hints
   - Command output examples
   - Clear visual hierarchy

## Special Features

### For Implementation Guides
- Component file templates
- Test case examples
- Integration points

### For Upgrade Guides
- Breaking change matrices
- Migration scripts
- Compatibility tables

### For Troubleshooting Guides
- Symptom-to-solution mappings
- Diagnostic command sets
- Log analysis patterns

### For Release Guides
- Pre-flight checklists
- Automation scripts
- Rollback procedures

## Template Variables

When generating guides, use these variables for consistency:

- `{{PROJECT_NAME}}` - The project or component name
- `{{VERSION}}` - Version number being documented
- `{{DATE}}` - Current date in YYYY-MM-DD format
- `{{COMMAND_PREFIX}}` - Project-specific command prefix
- `{{ERROR_CONTACT}}` - Where to report issues

## Quality Checklist

Before finalizing any guide:

- [ ] All commands tested and working
- [ ] Decision points have explicit criteria
- [ ] State tracking covers all variables
- [ ] Recovery procedures for each step
- [ ] Examples are complete and runnable
- [ ] Language is clear and unambiguous
- [ ] Structure follows template guidelines
- [ ] Both audiences addressed (if applicable)

## Integration with Other Commands

Combine with other slash commands for comprehensive documentation:

```
/create-guide implementation auth-system --for both
/test-runner create auth-integration-tests
/code-review focus=documentation
```

This creates a full documentation suite with implementation guide, tests, and review focus.