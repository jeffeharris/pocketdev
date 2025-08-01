# UX-005: Projects Page Scannability Analysis

**Component**: Projects listing page (`/frontend/src/pages/Projects.tsx`)  
**Date**: 2025-08-01  
**Analyst**: Steve Krug UX Detective

## 🔍 Quick Verdict: Needs Work

The Projects page has solid bones but makes users think too much about what to do next. While the basic structure is sound, several elements violate the "Don't Make Me Think" principle by hiding important actions, using ambiguous labels, and failing to create a clear visual hierarchy.

## 🚨 Don't Make Me Think Violations

### 1. **Confusing Click Targets**
**Element**: Entire project card is clickable but has "View Tasks →" link  
**Why it makes users think**: Users wonder - do I click the card or the link? Are they different?  
**Suggested fix**: Remove "View Tasks →" text entirely. The whole card should obviously be clickable with a hover state. If you need text, use "3 active tasks" as descriptive text, not a link.

### 2. **Hidden Primary Actions**
**Element**: No visible edit/delete options for projects  
**Why it makes users think**: "How do I rename this project? How do I delete it?"  
**Suggested fix**: Add a subtle three-dot menu (⋮) in the top-right corner of each card that appears on hover. This is a standard pattern users recognize.

### 3. **Ambiguous Status Information**
**Element**: "3 active tasks" - what does "active" mean?  
**Why it makes users think**: Active = in progress? Active = not completed? Active = has AI working?  
**Suggested fix**: Be specific: "3 tasks in progress" or just "3 tasks". Consider adding a small progress indicator if some tasks are completed.

### 4. **Truncated Critical Information**
**Element**: Repository URL truncated with ellipsis  
**Why it makes users think**: "Is this my work repo or personal? I can't see the full path"  
**Suggested fix**: Show just the repo name prominently (e.g., "my-project") and put the full path in a tooltip or smaller text that wraps instead of truncates.

### 5. **Buried Visual Hierarchy**
**Element**: GitBranch icon gets the most visual weight, but provides least information  
**Why it makes users think**: The icon draws attention but doesn't help identify projects  
**Suggested fix**: Make project names larger and bolder. Consider using first letter of project name in the icon circle for quick scanning.

### 6. **Mobile Settings Confusion**
**Element**: Settings button shows only icon on mobile without label  
**Why it makes users think**: "What does this gear do? User settings? App settings?"  
**Suggested fix**: Always show "Settings" text, or use a more specific icon like sliders (for preferences).

## ✅ What's Working Well

- **Clear page title**: "PocketDev Projects" immediately tells users where they are
- **Obvious create action**: Dashed border "Create New Project" card follows established patterns
- **Clean empty state**: Clear message and CTA when no projects exist
- **Responsive grid**: Adapts well to different screen sizes
- **Loading states**: Proper feedback during data fetching

## 🎯 Priority Fixes (ordered by impact)

### 1. **Fix Click Confusion** - Remove "View Tasks →" link
Make the entire card obviously clickable:
```tsx
// Add hover state to card
className="block bg-white rounded-lg shadow-sm border border-gray-200 
  hover:shadow-md hover:border-gray-300 transition-all cursor-pointer"

// Remove the "View Tasks →" link entirely
// Replace with simple task count
<span className="text-sm text-gray-600">
  {project.tasksCount || 0} {project.tasksCount === 1 ? 'task' : 'tasks'}
</span>
```

### 2. **Show Full Repository Information** - Fix truncation
Display repository name prominently and full path below:
```tsx
<div>
  <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
  <p className="text-xs text-gray-500 mt-1 break-all">{project.repository}</p>
</div>
```

### 3. **Add Project Actions Menu** - Surface hidden actions
Add a menu button that appears on hover/focus:
```tsx
<div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
  <button className="p-1 rounded hover:bg-gray-100">
    <MoreVertical className="w-4 h-4 text-gray-500" />
  </button>
</div>
```

### 4. **Improve Visual Hierarchy** - Make scanning easier
- Increase project name font size to `text-xl`
- Move base branch info to same line as task count
- Use color coding or badges for projects with many tasks
- Consider project-specific colors or avatars

### 5. **Clarify Create Project Flow** - Set expectations
In the modal, add step indicators:
```
Step 1: Select Repository → Step 2: Choose Branch → Step 3: Confirm
```

## 💡 Quick Wins (easy fixes with big impact)

### 1. **Add Hover States**
```css
.project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
```

### 2. **Bigger Project Names**
Change from `font-semibold` to `text-lg font-bold` - takes 30 seconds, huge improvement in scannability

### 3. **Remove Ambiguous Language**
- Change "active tasks" → "tasks"
- Change "View Tasks →" → remove entirely
- Settings icon → "Settings" (always show text)

### 4. **Add Task Progress Indicator**
Show a subtle progress bar or "2 of 5 complete" text to give context

### 5. **Loading Skeleton**
Instead of spinner, show ghost cards in the same layout - maintains spatial consistency

## 📊 Scannability Score: 5/10

- **Key information visibility**: 4/10 (truncated URLs, small project names)
- **Visual hierarchy**: 5/10 (icon gets too much weight, important info is small)
- **Actionable elements clarity**: 6/10 (confusing dual click targets, hidden actions)

## 🔄 Next Steps

### Immediate Testing
1. **5-second test**: Show the page to someone for 5 seconds. Can they name 3 projects and identify what to click?
2. **First click test**: Where do users click to view a project? Track if they hit the card or the "View Tasks" link

### Quick Implementation
1. Remove "View Tasks →" link (5 minutes)
2. Increase project name size (2 minutes)
3. Add hover states to cards (10 minutes)
4. Fix repository URL truncation (15 minutes)

### Future Iterations
1. Add project actions menu (2 hours)
2. Implement task progress indicators (1 hour)
3. Create visual differentiation between projects (colors/avatars) (3 hours)
4. Redesign the create project flow with clear steps (4 hours)

## Visual Comparison: Current vs. Proposed

### Current Design Problems
```
┌─────────────────────────────────┐
│ [Git] my-project         ⋮      │ ← Icon gets visual weight
│       main               hidden │ ← Branch info buried  
│                                 │
│ github.com/user/very-lon... ← Truncated, critical info hidden
│                                 │
│ 3 active tasks  View Tasks → │ ← Confusing dual CTAs
└─────────────────────────────────┘
   ↑                        ↑
   Whole card clickable?    Or just this?
```

### Proposed Improvements
```
┌─────────────────────────────────┐
│ My Project               ⋮      │ ← Name prominent, menu visible on hover
│ user/my-awesome-project         │ ← Full repo path visible
│                                 │
│ ▓▓▓▓▓▓░░░░ 3 of 5 tasks        │ ← Progress indicator  
│ main branch                     │ ← Context on same line
└─────────────────────────────────┘
   ↑
   Entire card obviously clickable (hover state)
```

## Summary

The Projects page is trying to be helpful but ends up creating confusion. By removing the redundant "View Tasks" link, making project names more prominent, and surfacing hidden actions, we can transform this from a "pause and figure it out" experience to an "of course that's how it works" interface.

Remember Krug's maxim: "Get rid of half the words on each page, then get rid of half of what's left." This page has too many words saying too little. Make every element earn its place by being self-evident.