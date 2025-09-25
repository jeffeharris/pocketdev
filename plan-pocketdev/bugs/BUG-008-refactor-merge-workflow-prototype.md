# BUG-008: Refactor MergeWorkflowPrototype to focus on its core purpose

<!-- Document Metadata
Created: 2025-08-01
Modified: 2025-08-01
Status: ????
-->


## Issue
The `MergeWorkflowPrototype.tsx` component has grown to 1,173 lines, far beyond what a prototype should be. It's trying to test multiple unrelated features in one file, making it difficult to extract useful parts for production.

## Current Problems
1. **Mixed purposes**: Testing task status displays AND workspace layout AND keyboard navigation
2. **Component-within-component**: TaskStatusPrototype defined inline (lines 65-229)
3. **Massive mock workspace**: Lines 791-1170 contain a full UI mockup that should be separate
4. **Complex keyboard navigation**: Not related to the core status display testing
5. **Duplicate dropdown logic**: Copy-pasted state management for each dropdown
6. **Hidden Tailwind hack**: Line 412 uses hidden div to force class generation
7. **Inline styles mixed with Tailwind**: Lines 422-442 mix approaches

## Root Cause
This prototype has become a "kitchen sink" where every merge-related idea gets thrown in, losing its experimental focus.

## Proposed Solution
Extract into focused, single-purpose prototypes:

```
frontend/src/prototypes/merge-workflow/
├── TaskStatusVariants.tsx        # ~300 lines - ONLY status display experiments
├── GitActionDropdowns.tsx        # ~150 lines - Reusable dropdown components
├── KeyboardNavigation.tsx        # ~100 lines - Navigation experiments
├── MockWorkspace.tsx             # ~300 lines - Full workspace UI mockup
└── index.tsx                     # ~50 lines - Simple menu to access each prototype
```

### 1. TaskStatusVariants.tsx
Extract lines 8-229 (mock data + TaskStatusPrototype component)
- Focus: Testing different ways to display worker + git status
- Keep: The 3 display variants (compact, detailed, inline)
- Remove: Everything else

### 2. GitActionDropdowns.tsx
Extract the dropdown patterns (commit options, update options)
- Make them reusable components
- Single source of truth for dropdown behavior
- Can be used in production later

### 3. KeyboardNavigation.tsx
Extract lines 269-365 (keyboard shortcut logic)
- Isolated experiment for navigation patterns
- Easy to test without the UI clutter

### 4. MockWorkspace.tsx
Extract lines 791-1170
- Pure UI mockup for design purposes
- No complex logic, just visual layout

## Benefits
- Each prototype has a single, clear purpose
- Easy to graduate successful experiments to production
- Failed experiments can be deleted without affecting others
- Total lines reduced from 1,173 to ~900 across 4 focused files
- Can import and compose prototypes as needed

## Success Criteria
- [ ] Original file deleted or reduced to < 100 lines
- [ ] Each new prototype file under 400 lines
- [ ] Clear separation of concerns
- [ ] Successful patterns easily extractable to production
- [ ] No duplicate code between prototypes

## Priority
Medium - This is blocking the ability to extract useful patterns for production use

## Related
- PrototypeMergeConflict.tsx (BUG-006) - Similar pattern of prototype bloat
- Both serve different purposes but suffer from scope creep
- Part of the "Marie Kondo" cleanup initiative