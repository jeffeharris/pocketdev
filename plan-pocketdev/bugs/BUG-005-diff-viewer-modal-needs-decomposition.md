# BUG-005: DiffViewerModal.tsx needs decomposition

## Issue
The `DiffViewerModal.tsx` component has ballooned to 1207 lines, making it the largest component in the frontend. This modal is handling too many responsibilities and has become difficult to maintain.

## Current Problems
1. **File too large**: 1207 lines for a single modal component
2. **37 React hooks**: Excessive use of useState, useEffect, useRef, useMemo, useCallback
3. **9 useEffect hooks**: Complex lifecycle management and potential race conditions
4. **Mixed responsibilities**: 
   - Modal management
   - File list rendering with grouping/filtering
   - Diff loading and caching
   - Monaco editor configuration
   - Keyboard shortcuts
   - Git staging/unstaging operations
   - Search functionality
   - Sidebar collapse state
   - View mode switching
5. **Inline JSX complexity**: The return statement alone spans ~500 lines (lines 681-1207)
6. **Repeated patterns**: Multiple similar file list renderings for staged/unstaged/untracked

## Impact
- Difficult to understand component behavior
- Hard to test individual features
- Performance issues from excessive re-renders
- High cognitive load when debugging
- Risky to modify without breaking other features

## Proposed Solution
Break down into focused sub-components:

```
frontend/src/components/diff/
├── DiffViewerModal.tsx          # Main container (~200 lines)
├── DiffViewerSidebar.tsx        # File list sidebar (~300 lines)
├── DiffViewerEditor.tsx         # Monaco editor wrapper (~150 lines)
├── DiffViewerHeader.tsx         # Header with controls (~100 lines)
├── DiffViewerFooter.tsx         # Footer with shortcuts (~50 lines)
├── FileListSection.tsx          # Reusable file list component
├── hooks/
│   ├── useDiffLoader.ts         # Diff loading logic
│   ├── useDiffNavigation.ts     # File navigation logic
│   └── useGitOperations.ts      # Staging/unstaging logic
└── utils/
    ├── diffHelpers.ts           # Diff parsing utilities
    └── fileGrouping.ts          # File categorization logic
```

## Specific Extractions

### DiffViewerSidebar
- File list rendering
- Search functionality
- File grouping (staged/unstaged/untracked)
- Collapse state

### DiffViewerEditor
- Monaco DiffEditor configuration
- Split/unified view handling
- Code parsing from diff format

### useDiffLoader hook
- `loadDiffData` function
- `loadFileDiff` function
- Caching logic
- Loading states

### useGitOperations hook
- `handleStageToggle` function
- Pending operations tracking
- Git API calls

### FileListSection (reusable)
- Render a section of files (staged/unstaged/etc)
- Handle file selection
- Show loading states
- Eliminate the duplicated file list code

## Success Criteria
- [ ] Main modal component under 300 lines
- [ ] No more than 3-4 hooks per component
- [ ] Clear separation of concerns
- [ ] Reusable sub-components
- [ ] Easier to unit test individual features
- [ ] Performance improvement from reduced re-renders

## Priority
High - This is the largest component in the frontend and affects a core feature (viewing diffs)

## Related
- Part of the "Marie Kondo" cleanup initiative
- Similar patterns could be applied to other large modals in the codebase