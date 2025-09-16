# Phase 5 & 6 Handoff Guide

<!-- Document Metadata
Created: 2025-07-28
Modified: 2025-07-28
Status: ????
-->


## Overview
This guide helps the next developer complete Phases 5 and 6 of the Git Diff Viewer Enhancement. Phase 4 is complete with the three-state toggle, StatusIcon, and basic search working. This document covers what remains and key implementation details.

## Current State

### What's Working
1. **Three-state toggle**: Working Tree / All Changes / Branch Diff
2. **StatusIcon component**: Shows git status with proper icons
3. **Basic search**: Manual toggle button, real-time filtering
4. **Client-side filtering**: Single data load, filters applied locally
5. **Empty states**: Contextual messages for each view mode

### What's Missing
1. **Search highlighting** in file paths (component exists but not integrated)
2. **Automatic search display** when >5 files
3. **Staging/unstaging UI** (backend API exists)
4. **Help tooltips** for git commands
5. **Unpushed commits detection** in empty states

## Phase 5: Complete Search Implementation

### Task 1: Integrate HighlightedPath Component
The `HighlightedPath` component already exists in `/frontend/src/components/diff/SearchInput.tsx` but isn't used.

**Current code in DiffViewerModal.tsx (line ~647):**
```tsx
<span className="truncate">{file.path}</span>
```

**Should become:**
```tsx
import { HighlightedPath } from './SearchInput';

// Then in the render:
{searchTerm ? (
  <HighlightedPath 
    path={file.path} 
    searchTerm={searchTerm}
    className="truncate"
    maxLength={40}
  />
) : (
  <span className="truncate">{file.path}</span>
)}
```

### Task 2: Auto-show Search for >10 Files
Currently using manual toggle. Need to modify the logic (threshold increased from 5 to 10).

**Current state management:**
```tsx
const [showSearch, setShowSearch] = useState(false);

// Auto-show logic exists but doesn't work properly:
useEffect(() => {
  if (files.length > 5 && !showSearch) {
    setShowSearch(true);
  }
}, [files.length]); // showSearch omitted to prevent loops
```

**Fix approach:**
- Use a ref to track if user manually toggled
- Only auto-show on initial load or when crossing threshold
- Respect user's manual choice

### Task 3: Enhanced Search Features ✅ COMPLETE
Instead of performance testing, implemented:
- **Scroll-to-highlight**: When search term changes, automatically scrolls to first matching file
- **Full path tooltips**: All file paths now show full path on hover (not just truncated ones)

## Phase 6: Staging/Unstaging Implementation

### Backend API Already Exists
The backend is ready in `/frontend/src/services/api.ts`:
```typescript
async stageFile(projectId: string, taskId: string, filePath: string)
async unstageFile(projectId: string, taskId: string, filePath: string)
```

These call the `gitOperation` endpoint with 'add' and 'unstage' operations.

### Task 1: Make Status Icons Clickable
Update StatusIcon component to be clickable for staging/unstaging files.

**Key changes needed:**

1. **Update StatusIcon component** (StatusIcon.tsx):
```tsx
// Note: StatusIcon uses gitStatus prop, not category!
interface StatusIconProps {
  gitStatus: string;  // Existing prop
  size?: 'sm' | 'md';
  showTooltip?: boolean;
  className?: string;
  onClick?: () => void;     // Add this
  disabled?: boolean;       // Add this
  isLoading?: boolean;      // Add this
}

// The component will need to conditionally wrap its render in a button
// See Task 3 below for full implementation details
```

2. **Update file list in DiffViewerModal** (around line 645):
```tsx
<StatusIcon 
  gitStatus={file.status || ''}  // Note: gitStatus, not status
  onClick={
    (file.category === 'staged' || file.category === 'unstaged' || file.category === 'untracked')
    && (compareWith === 'working' || compareWith === 'all')
      ? () => handleStageToggle(file)
      : undefined
  }
  isLoading={pendingOperations.has(file.path)}  // Per-file loading state
  disabled={pendingOperations.has(file.path)}
/>
```

3. **Consolidate all view controls** into single row (around line 540):
```tsx
// Replace the current two-row layout with single row containing all controls
<div className="flex items-center justify-between gap-4 mb-2">
  <div className="flex items-center gap-3">
    <h3 className="text-sm font-medium text-gray-700">
      Changes ({filteredFiles.length} files)
    </h3>
    <ThreeStateToggle 
      value={compareWith} 
      onChange={setCompareWith}
      size="sm"  // might need to add size prop
    />
    {/* Show staged/unstaged filter only for working/all modes */}
    {(compareWith === 'working' || compareWith === 'all') && stagedFiles.length > 0 && (
      <SegmentedControl
        value={filterMode}
        onChange={setFilterMode}
        options={[
          { value: 'all', label: 'All' },
          { value: 'staged', label: 'Staged' },
          { value: 'unstaged', label: 'Unstaged' }
        ]}
        size="sm"
      />
    )}
  </div>
  
  {/* Search toggle on the right */}
  <button
    onClick={() => setShowSearch(!showSearch)}
    className="p-1 text-gray-500 hover:text-gray-700"
    title="Toggle search"
  >
    <Search className="w-4 h-4" />
  </button>
</div>
```

### Task 2: Implement Handlers with Optimistic Updates
```typescript
// Track per-file operations (not global state)
const [pendingOperations, setPendingOperations] = useState<Set<string>>(new Set());

// Helper to update git status codes for icon changes
function getUpdatedGitStatus(currentStatus: string, action: 'stage' | 'unstage'): string {
  if (action === 'stage') {
    switch (currentStatus) {
      case '??': return 'A ';  // Untracked → Staged new file
      case ' M': return 'M ';  // Modified → Staged modified
      case ' D': return 'D ';  // Deleted → Staged deleted
      case 'MM': return 'M ';  // Modified staged+unstaged → All staged
      default: return currentStatus;
    }
  } else { // unstage
    switch (currentStatus) {
      case 'A ': return '??';  // Staged new → Untracked
      case 'M ': return ' M';  // Staged modified → Unstaged modified
      case 'D ': return ' D';  // Staged deleted → Unstaged deleted
      default: return currentStatus;
    }
  }
}

const handleStageToggle = async (file: DiffFile) => {
  const filePath = file.path;
  
  // Only prevent clicks on THIS file
  if (pendingOperations.has(filePath)) return;
  
  setPendingOperations(prev => new Set(prev).add(filePath));
  
  // Optimistically update git status (StatusIcon will auto-update)
  const action = file.category === 'staged' ? 'unstage' : 'stage';
  const newStatus = getUpdatedGitStatus(file.status || '', action);
  const newCategory = action === 'stage' ? 'staged' : 
                     (file.status === 'A ' ? 'untracked' : 'unstaged');
  
  const optimisticFiles = files.map(f => 
    f.path === filePath 
      ? { ...f, status: newStatus, category: newCategory }
      : f
  );
  setFiles(optimisticFiles);
  
  try {
    const result = action === 'unstage'
      ? await api.unstageFile(projectId, taskId, filePath)
      : await api.stageFile(projectId, taskId, filePath);
      
    if (result.success) {
      // Success - reload for consistency
      await loadDiffData(true);
      // No success toast - visual feedback is enough
    } else {
      // Revert on error
      setFiles(files);
      setToast({ message: result.error || `Failed to ${action} file`, type: 'error' });
    }
  } catch (error) {
    setFiles(files);
    setToast({ message: 'Network error', type: 'error' });
  } finally {
    setPendingOperations(prev => {
      const next = new Set(prev);
      next.delete(filePath);
      return next;
    });
  }
};
```

### Task 3: Update StatusIcon for Loading State
The StatusIcon component needs minor updates to show loading state:

```tsx
// In StatusIcon props interface:
interface StatusIconProps {
  gitStatus: string;
  size?: 'sm' | 'md';
  showTooltip?: boolean;
  className?: string;
  onClick?: () => void;     // Add this
  disabled?: boolean;       // Add this
  isLoading?: boolean;      // Add this
}

// Wrap the icon render with conditional button/loading:
if (onClick) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex items-center justify-center ${className}`}
      title={showTooltip ? tooltipText : undefined}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      ) : (
        // existing icon render
      )}
    </button>
  );
}
// else return existing non-clickable render
```

## Important Architecture Notes

### 1. Status Codes vs Categories
- **status**: Git status codes like "MM", " M", "??", "A", "M" (for committed)
- **category**: Backend-assigned categories like "staged", "unstaged", "committed"
- StatusIcon component uses the `gitStatus` prop (status codes), not categories
- Optimistic updates must update both status and category for correct behavior

### 2. Compare Modes
- **working**: Shows uncommitted changes only
- **all**: Shows everything (working + committed)
- **base**: Shows only committed changes not in base branch

### 3. Caching Strategy
- File diffs are cached by `${compareWith}:${filePath}`
- All changes data is cached in `diffCache.current.allData`
- Cache clears when modal closes

### 4. State Updates
The backend has a git status monitor that updates every 30 seconds. After staging operations, it should trigger an immediate update via `triggerStatusUpdate`.

## Testing Considerations

1. **Multi-file staging**: Test staging multiple files quickly
2. **Edge cases**: 
   - Staging a deleted file
   - Unstaging a new file
   - Files with merge conflicts
3. **State consistency**: Ensure UI updates match actual git state
4. **Error handling**: Network failures, git operation failures

## Phase 7 Preview (Nice to Have)

If time permits after completing Phases 5 & 6:

1. **Help tooltips**: Add info icon showing git commands used for each view
2. **Unpushed commits**: The backend already provides this in `getAllChanges` response
3. **Suggested actions**: In empty states, add buttons like "Create first commit" or "Push changes"

## Quick Start Commands

```bash
# Start dev environment
make dev

# Test with a task that has many files
# Create test files in a task's worktree

# Watch the backend logs for git operations
docker logs -f backend

# Check if staging operations trigger status updates
# Look for "triggerStatusUpdate" in logs
```

## Key Files Reference

- **Main component**: `/frontend/src/components/diff/DiffViewerModal.tsx`
- **Search components**: `/frontend/src/components/diff/SearchInput.tsx`
- **Status icons**: `/frontend/src/components/diff/StatusIcon.tsx`
- **API service**: `/frontend/src/services/api.ts`
- **Backend controller**: `/backend/controllers/task-git.controller.js`
- **Planning doc**: `/.pocketdev/PLANNING.md`

Good luck with the implementation! The architecture is solid and most of the hard work is done. Focus on wiring up the existing pieces rather than building new ones.