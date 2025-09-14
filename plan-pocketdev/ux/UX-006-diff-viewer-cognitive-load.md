# UX-006: Diff Viewer Cognitive Load Analysis

<!-- Document Metadata
Created: 2025-08-01
Modified: 2025-08-01
Status: ????
-->


## Steve Krug UX Detective Report
**Component**: DiffViewerModal and related diff viewing components  
**Date**: January 2025  
**Severity**: Critical Issues Found

---

## 🔍 Quick Verdict: **Needs Work**

The diff viewer is functionally comprehensive but violates several core "Don't Make Me Think" principles. Users face significant cognitive friction when trying to understand what they're looking at and what actions they can take.

---

## 🚨 Don't Make Me Think Violations

### 1. **Three-State Toggle Mystery**
- **Element**: "Uncommitted" / "All" / "Committed" toggle
- **Why it makes users think**: These labels require mental translation. What's the difference between "All" and everything else? Why would I want "Uncommitted" vs "All"?
- **Suggested fix**: Use clearer labels like:
  - "My Changes" (working)
  - "Ready to Merge" (all)  
  - "Already Pushed" (base)
  
### 2. **Clickable vs Non-Clickable Status Icons**
- **Element**: File status icons that are sometimes buttons
- **Why it makes users think**: No visual affordance indicates which icons are clickable. Users must hover or click to discover functionality.
- **Suggested fix**: Add subtle button styling (border, shadow, or background) to clickable icons. Use cursor:pointer consistently.

### 3. **Hidden Staging/Unstaging Actions**
- **Element**: Click on status icon to stage/unstage
- **Why it makes users think**: Critical functionality is hidden behind non-obvious UI. The tooltip only appears on hover.
- **Suggested fix**: Add explicit "Stage" / "Unstage" buttons next to each file, or use toggle switches with clear labels.

### 4. **Comparison Context Confusion**
- **Element**: "HEAD → Working Tree" labels at bottom of diff
- **Why it makes users think**: Git terminology assumes expertise. What's HEAD? What's a Working Tree?
- **Suggested fix**: Use human-friendly labels:
  - "Current Version → Your Changes"
  - "Main Branch → This Branch"
  - "Before → After"

### 5. **Auto-Appearing Search at 10 Files**
- **Element**: Search that automatically shows when >10 files
- **Why it makes users think**: Unexpected UI changes are jarring. Why did this appear? Can I make it go away?
- **Suggested fix**: Always show search icon, expand on click. Add subtle animation and message: "Showing search for 10+ files"

### 6. **Collapsed Sidebar State**
- **Element**: Sidebar that collapses to icons only
- **Why it makes users think**: When collapsed, the vertical text and minimal icons don't clearly indicate what this panel contains
- **Suggested fix**: Keep file count badge visible, add clearer "Files" label, consider keeping it slightly wider with truncated filenames

### 7. **Split vs Unified View Toggle**
- **Element**: Small toggle buttons with icons only
- **Why it makes users think**: Icons (Columns2, FileCode) aren't self-explanatory for diff viewing modes
- **Suggested fix**: Add text labels to icons: "Side by Side" and "Inline Changes"

### 8. **Loading States Without Context**
- **Element**: Generic "Loading diff..." messages
- **Why it makes users think**: No indication of progress or what's happening
- **Suggested fix**: Show specific loading states: "Fetching changes from server..." "Processing 45 files..." with progress indicators

---

## ✅ What's Working Well

1. **Keyboard Navigation**: Arrow keys and shortcuts are well-implemented
2. **Visual Diff Colors**: Green/red for additions/deletions is standard and clear
3. **File Change Summary**: +23 -5 format is universally understood
4. **Toast Notifications**: Error messages appear in context (though could be clearer)
5. **Responsive Design**: Graceful degradation from split to unified view

---

## 🎯 Priority Fixes (ordered by impact)

### 1. **Make Staging Actions Obvious** - CRITICAL
Replace hidden icon clicks with explicit UI:
```tsx
// Instead of clickable StatusIcon
<div className="flex items-center gap-2">
  <StatusIcon gitStatus={file.status} />
  <span>{file.path}</span>
  {file.category !== 'committed' && (
    <button className="ml-auto text-xs px-2 py-1 rounded border">
      {file.category === 'staged' ? 'Unstage' : 'Stage'}
    </button>
  )}
</div>
```

### 2. **Clarify the Three-State Toggle** - HIGH
Add descriptive subtitles:
```tsx
const OPTIONS = [
  {
    value: 'working',
    label: 'My Changes',
    subtitle: 'Unsaved edits',
    tooltip: 'Show only changes you haven\'t committed yet'
  },
  {
    value: 'all', 
    label: 'Full Diff',
    subtitle: 'Everything',
    tooltip: 'Show all differences from main branch'
  },
  {
    value: 'base',
    label: 'Commits Only',
    subtitle: 'Already saved', 
    tooltip: 'Show only changes that have been committed'
  }
];
```

### 3. **Humanize Git Terminology** - HIGH
Create a terminology map and use consistently:
- HEAD → "Current Version"
- Working Tree → "Your Edits"  
- Staged → "Ready to Save"
- Unstaged → "Not Ready"
- Base Branch → "Main Branch"

### 4. **Add Diff Overview Panel** - MEDIUM
Before users dive into files, show a summary:
```
Changes Overview:
• 12 files modified
• 4 new files added  
• 245 lines added, 67 removed
• No merge conflicts ✓

[Review Changes] [Create Pull Request]
```

---

## 💡 Quick Wins (easy fixes with big impact)

1. **Add "What's This?" Help Icons**
   - Next to three-state toggle
   - Next to staging area labels
   - Link to simple explanations

2. **Show File Paths Better**
   ```
   // Instead of: src/components/diff/DiffViewerModal.tsx
   // Show as: components → diff → DiffViewerModal.tsx
   ```

3. **Loading State Improvements**
   - Show file count while loading: "Loading 23 files..."
   - Add subtle progress bar
   - Cache indicators: "Using cached diff ⚡"

4. **Clearer Empty States**
   - Instead of: "No changes to display"
   - Use: "✓ All changes have been committed - nothing left to review!"

5. **Sticky Headers**
   - Keep comparison context visible while scrolling
   - Pin filename at top of diff view

---

## 📊 Scannability Score: **4/10**

- **Key information visibility**: 3/10 (buried in toggles and icons)
- **Visual hierarchy**: 4/10 (too many competing elements)
- **Actionable elements clarity**: 5/10 (unclear what's clickable)

### Why It's Hard to Scan:
1. Three columns of information compete for attention
2. Status icons blend with decorative elements
3. No clear visual grouping of staged/unstaged files
4. File paths are hard to parse quickly
5. Action buttons are inconsistently placed

---

## 🔄 Next Steps

### Immediate Testing Needs:
1. **First-Time User Test**: Watch someone who's never used git try to understand the diff viewer
2. **Task Completion Test**: "Stage these 3 files and unstage this one" - time how long it takes
3. **Terminology Test**: Show the interface and ask users to explain what each section means

### Design Iterations:
1. **Progressive Disclosure**: Start with a simple view, add complexity as needed
2. **Guided Mode**: First-time tour highlighting key actions
3. **Context-Sensitive Help**: Tooltips that explain git concepts in plain English

### Implementation Priority:
1. Week 1: Fix staging/unstaging UI (critical path blocker)
2. Week 2: Improve three-state toggle clarity
3. Week 3: Add overview panel and improve empty states
4. Week 4: Polish loading states and help system

---

## 📝 Additional Observations

### Accessibility Concerns:
- Keyboard navigation works but isn't discoverable
- No screen reader announcements for state changes
- Color-only indicators for file status
- Small click targets for mobile

### Performance Impact on Usability:
- 1200+ line component suggests complexity that users feel
- Lazy loading helps but adds cognitive overhead
- State management across multiple files is confusing

### Comparison to Git Standards:
- Deviates from GitHub/GitLab patterns users know
- Unique interactions increase learning curve
- Consider adopting more standard patterns

---

## Summary

The diff viewer tries to be clever with its compact design and hidden functionality, but this violates Krug's prime directive: **Don't Make Me Think**. Every hidden interaction, every unclear label, and every assumption about git knowledge creates friction.

The path forward is clear: make the invisible visible, replace jargon with plain language, and give users obvious buttons for common actions. The functionality is solid - it just needs to stop hiding behind clever UI.

Remember Krug's wisdom: "If you can't make something self-evident, you at least need to make it self-explanatory."