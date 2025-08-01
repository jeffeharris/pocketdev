# BUG-009: Sidebar component needs decomposition

## Issue
The `Sidebar.tsx` component has grown to 903 lines and is handling too many responsibilities. It's become a kitchen sink for task management, git operations, modals, and attachments.

## Current Problems
1. **Three inline modal definitions**: Rename (758-793) and Reset (796-901) modals defined inside the component
2. **Massive git action logic**: Lines 469-657 contain a 188-line nested if/else chain in the render method
3. **Duplicate dropdown management**: Three separate dropdowns with repeated click-outside logic
4. **Direct API calls**: Component makes API calls directly instead of using hooks/services
5. **Mixed concerns**: Task UI + Git orchestration + Image uploads + Modal management + WebSocket events
6. **Complex state management**: 15+ useState hooks tracking various UI states

## Impact
- Hard to test individual features
- Performance issues from complex re-renders
- Difficult to add new git actions
- Modal logic tightly coupled to sidebar
- High cognitive load when debugging

## Proposed Solution
Break into focused components and hooks:

```
frontend/src/components/
├── sidebar/
│   ├── Sidebar.tsx                    # ~200 lines - Main container
│   ├── TaskDetails.tsx                # ~100 lines - Task header section
│   ├── GitStatusPanel.tsx             # ~150 lines - Git status display
│   ├── GitActionsPanel.tsx            # ~150 lines - Context-aware git buttons
│   ├── AttachmentsSection.tsx         # ~80 lines - Image attachments
│   ├── TaskList.tsx                   # ~80 lines - All tasks list
│   └── hooks/
│       ├── useGitActions.ts           # Git operation logic
│       ├── useTaskModals.ts           # Modal state management
│       └── useDropdownManager.ts      # Reusable dropdown logic
├── modals/
│   ├── RenameTaskModal.tsx           # ~60 lines
│   └── ResetCommitModal.tsx          # ~120 lines
```

### Key Refactorings

#### 1. Extract Git Action Logic
```typescript
// useGitActions.ts
export const useGitActions = (task: Task, projectId: string) => {
  const getActionButton = () => {
    const { hasConflicts, staged, unstaged, untracked, behind, ahead } = task.gitStatus || {};
    
    if (hasConflicts) return { type: 'resolve-conflicts', priority: 1 };
    if (staged + unstaged + untracked > 0) return { type: 'commit', priority: 2 };
    if (behind > 0) return { type: 'update', priority: 3 };
    if (ahead > 0) return { type: 'push-or-merge', priority: 4 };
    return null;
  };
  
  return { getActionButton, /* other git operations */ };
};
```

#### 2. Extract Modal Components
Move inline modals to separate files with their own state management.

#### 3. Create Dropdown Manager Hook
```typescript
// useDropdownManager.ts
export const useDropdownManager = () => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const refs = useRef<Map<string, HTMLElement>>(new Map());
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Single click-outside handler for all dropdowns
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return { openDropdown, setOpenDropdown, registerRef };
};
```

#### 4. Simplify Git Actions Rendering
Replace the massive if/else with a component map:
```typescript
const ACTION_COMPONENTS = {
  'resolve-conflicts': ResolveConflictsButton,
  'commit': CommitDropdown,
  'update': UpdateDropdown,
  'push-or-merge': PushOrMergeButtons,
};

const GitActionsPanel = ({ task }) => {
  const { getActionButton } = useGitActions(task);
  const action = getActionButton();
  
  if (!action) return null;
  
  const Component = ACTION_COMPONENTS[action.type];
  return <Component task={task} />;
};
```

## Success Criteria
- [ ] Main Sidebar component under 300 lines
- [ ] No inline modal definitions
- [ ] Git action logic extracted to hooks
- [ ] Reusable dropdown management
- [ ] Each sub-component focused on single responsibility
- [ ] Improved performance from reduced re-renders

## Priority
High - Core UI component that affects daily usage

## Related
- Part of the "Marie Kondo" cleanup initiative
- Similar patterns could be applied to other large UI components