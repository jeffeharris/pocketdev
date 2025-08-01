# BUG-006: Simplify PrototypeMergeConflict component

## Issue
The `PrototypeMergeConflict.tsx` component is 1,041 lines and overly complex for what should be a straightforward merge conflict UI. It contains duplicate code, overly clever features, and unnecessary complexity that makes it hard to integrate into production.

## Current Problems
1. **Duplicate accept functions**: Three separate 40+ line functions (`acceptCurrentSingle`, `acceptIncomingSingle`, `acceptBothSingle`) doing nearly identical operations
2. **Over-engineered navigation**: Complex indentation detection logic (lines 379-444) trying to be too smart about context
3. **Repeated DiffEditor configs**: Three nearly identical DiffEditor setups with only minor differences
4. **Dual view modes**: Supporting both inline and three-way views doubles complexity without clear benefit
5. **Manual decoration management**: Complex tracking that Monaco could handle more automatically
6. **Too many state variables**: 11 different state hooks tracking various aspects

## Simplification Opportunities

### 1. Unify Accept Functions
Replace three separate functions with one:
```typescript
const acceptChanges = (
  strategy: 'current' | 'incoming' | 'both', 
  conflictIndex: number = currentConflict
) => {
  const conflict = conflictRanges[conflictIndex];
  const model = editorRef.current.getModel();
  const lines = model.getLinesContent();
  
  // Extract sections based on conflict markers
  const { before, current, incoming, after } = extractConflictSections(lines, conflict);
  
  // Build resolved content based on strategy
  let resolved: string[];
  switch (strategy) {
    case 'current': resolved = [...before, ...current, ...after]; break;
    case 'incoming': resolved = [...before, ...incoming, ...after]; break;
    case 'both': resolved = [...before, ...current, ...incoming, ...after]; break;
  }
  
  // Apply edit
  const range = new monaco.Range(conflict.startLine, 1, conflict.endLine, 
    lines[conflict.endLine - 1].length + 1);
  model.pushEditOperations([], [{ range, text: resolved.join('\n') }], null);
}
```

### 2. Simplify Navigation
Remove the complex indentation detection:
```typescript
const navigateToConflict = (index: number) => {
  if (!editorRef.current || index < 0 || index >= conflictRanges.length) return;
  
  const conflict = conflictRanges[index];
  const editor = editorRef.current;
  
  // Simply reveal the conflict with some context
  editor.revealLineInCenter(conflict.startLine);
  
  // Select the entire conflict region
  editor.setSelection({
    startLineNumber: conflict.startLine,
    startColumn: 1,
    endLineNumber: conflict.endLine,
    endColumn: editor.getModel().getLineMaxColumn(conflict.endLine)
  });
  
  setCurrentConflict(index);
};
```

### 3. Extract Reusable DiffEditor Component
```typescript
interface MergeDiffEditorProps {
  title: string;
  titleColor: 'red' | 'green' | 'purple';
  original: string;
  modified: string;
  height?: string;
  showMinimap?: boolean;
}

const MergeDiffEditor: React.FC<MergeDiffEditorProps> = ({
  title, titleColor, original, modified, height = "300px", showMinimap = false
}) => {
  const colorClasses = {
    red: 'bg-red-50 text-red-800 border-red-200',
    green: 'bg-green-50 text-green-800 border-green-200',
    purple: 'bg-purple-50 text-purple-800 border-purple-200'
  };
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className={`px-4 py-2 text-sm font-medium border-b ${colorClasses[titleColor]}`}>
        {title}
      </div>
      <DiffEditor
        height={height}
        language="typescript"
        original={original}
        modified={modified}
        theme="vs"
        options={STANDARD_DIFF_OPTIONS}
      />
    </div>
  );
};
```

### 4. Pick One View Mode
Recommend keeping only the three-way view and removing inline mode:
- Three-way view is clearer for understanding what changed
- Inline editing can still happen in the main editor
- Reduces component complexity by ~40%

### 5. Centralize Monaco Options
```typescript
const STANDARD_DIFF_OPTIONS = {
  readOnly: true,
  renderSideBySide: true,
  minimap: { enabled: false },
  scrollbar: { 
    vertical: 'visible',
    horizontal: 'auto',
    verticalScrollbarSize: 10,
    useShadows: false
  },
  scrollBeyondLastLine: false,
  padding: { top: 10, bottom: 10 },
  diffAlgorithm: 'advanced',
  renderValidationDecorations: 'off'
};
```

## Expected Result
- **Reduce from 1,041 to ~500-600 lines**
- **Cleaner, more maintainable code**
- **Easier to integrate into production**
- **Better performance** (fewer re-renders, simpler state)
- **More testable** (isolated functions)

## Success Criteria
- [ ] Single unified accept function
- [ ] Simplified navigation without clever indentation logic
- [ ] Reusable DiffEditor component
- [ ] Remove dual view mode complexity
- [ ] Extract Monaco configurations
- [ ] Reduce state variables from 11 to 5-6
- [ ] Total line count under 600

## Priority
High - This needs to be simplified before integrating into the production merge workflow

## Related
- BUG-005: DiffViewerModal needs decomposition (similar patterns)
- Future: Integration with production merge workflow