# Phase 4 Handoff Guide

## Context
This document provides essential context for implementing Phase 4 of the Git Diff Viewer Enhancement. Phase 3 (UI components) is complete and all components are production-ready.

## What Was Built in Phase 3

### Components Created (in `/frontend/src/components/diff/`)

1. **StatusIcon.tsx** (RECOMMENDED)
   - Priority-based file status indicator using single icons
   - Priority: Conflict > Deleted > New > Modified > Staged
   - Green dot shows files with additional staged changes
   - Usage: `<StatusIcon gitStatus="MM" size="sm" />`

2. **ThreeStateToggle.tsx**
   - Replaces two-state toggle with: Working Tree | All Changes | Base Branch
   - Matches existing DiffViewerModal button style (see lines 428-462)
   - Usage: `<ThreeStateToggle value={mode} onChange={setMode} />`
   - **Important**: Wrap in flex container to prevent stretching

3. **SearchInput.tsx**
   - File search with path highlighting and smart truncation
   - Only shows when totalItems > minItemsToShow (default: 5)
   - Includes `HighlightedPath` component for search matches
   - Usage: `<SearchInput value={search} onChange={setSearch} totalItems={files.length} />`

### Key Implementation Notes

1. **TypeScript Types**
   - Changed from enums to const assertions (see `/frontend/src/types/diff.ts`)
   - `DiffViewMode` already includes 'all' option
   - `AllChangesResponse` interface already exists

2. **API Integration**
   - Backend already supports `compareWith: 'all'` parameter
   - Endpoint: `/api/projects/:projectId/tasks/:taskId/git/diff?compareWith=all`
   - Returns comprehensive diff data with file categories

3. **Current DiffViewerModal Structure**
   - File list sidebar: lines 473-558
   - Comparison toggle: lines 425-468
   - File selection logic: lines 495-530
   - Already shows line counts (+/-) in file list

## Phase 4 Integration Points

### 1. Replace Two-State Toggle (lines 428-462)
```tsx
// Current: Two buttons for working/base
// Replace with: <ThreeStateToggle value={compareWith} onChange={handleModeChange} />
// Note: compareWith would need to support 'all' in addition to 'working' and 'base'
```

### 2. Add StatusIcon to File List (around line 516)
```tsx
// Current: {getFileIcon(file.type)}
// Add: <StatusIcon gitStatus={file.status} size="sm" />
// Note: Need to add status field to DiffFile type or derive from existing data
```

### 3. Add Search Above File List (before line 495)
```tsx
<SearchInput 
  value={searchTerm}
  onChange={setSearchTerm}
  totalItems={files.length}
  placeholder="Search files..."
/>
```

### 4. Update loadDiffData for 'all' Mode
- Current implementation only handles 'working' and 'base'
- Need to handle response.allChanges when compareWith === 'all'
- Group files by status for better organization

## Git Status Mapping

The backend returns git status codes (e.g., "MM", "A ", " M", "??"). Use the `StatusIcon` component which handles the mapping automatically. Reference: `/docs/git-status-codes.md`

## Testing Approach

1. **Component Playground** (archived but accessible)
   - Location: `/frontend/src/pages/archive/ComponentPlayground-phase3.tsx`
   - To resurrect: Uncomment imports and route in App.tsx
   - Visit: http://localhost:5173/prototype/components

2. **Test Scenarios**
   - Working tree with various file states
   - Clean working tree (should default to 'all' or 'base' view)
   - Files with both staged and unstaged changes (MM status)
   - Large file lists (>5 files to trigger search)

## Common Pitfalls to Avoid

1. **Toggle Stretching**: ThreeStateToggle needs a flex wrapper or it will stretch
2. **Dark Mode**: Don't add dark mode classes - app uses light theme only
3. **Status Priority**: Let StatusIcon handle priority - don't show multiple badges
4. **Search Performance**: SearchInput already has 150ms debounce built in

## Next Steps for Phase 4

1. Start with state management updates to support three modes
2. Integrate ThreeStateToggle (easiest win)
3. Add StatusIcon to file list
4. Implement search functionality
5. Handle 'all' mode data loading and grouping

Good luck! The components are solid and ready to drop in. 🚀