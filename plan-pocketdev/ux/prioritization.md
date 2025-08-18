# UX Prioritization & Status

## Overview
This document tracks the prioritization and status of all filed UX issues in the PocketDev project. A clear pattern has emerged: **interfaces that make users think too much** throughout the application, violating Steve Krug's fundamental principles. The goal is to make PocketDev so intuitive that users focus on their work, not on figuring out the tool.

## Prioritization Table

| UX ID | Title | Component | Krug Violations | Priority | User Impact | Status | Target Date |
|-------|-------|-----------|-----------------|----------|-------------|---------|-------------|
| UX-003 | Header Navigation Clarity | Header/Nav | No app identity, cryptic IDs | **Critical** | Users lost, can't navigate | Open | 2025-08-05 |
| UX-001 | Visual Hierarchy - Project Dashboard | Dashboard | No clear entry point | **Critical** | Decision paralysis, missed alerts | Open | 2025-08-07 |
| UX-006 | Diff Viewer Cognitive Load | Diff Viewer | Hidden staging actions | **Critical** | Core workflow blocked | Open | 2025-08-09 |
| UX-004 | Sidebar Information Architecture | Sidebar | 900-line god component | **High** | Cognitive overload, slow tasks | Open | 2025-08-12 |
| UX-007 | Merge Conflict Resolution Complexity | Merge UI | Git jargon, 4 views at once | **High** | Merge failures, user frustration | Open | 2025-08-14 |
| UX-005 | Projects Page Scannability | Projects List | Confusing click targets | **Medium** | Inefficient navigation | Open | 2025-08-16 |
| UX-002 | Managing Complexity - Task Workspace | Task Workspace | Feature-rich but overwhelming | **Medium** | Power vs. simplicity balance | Open | 2025-08-18 |
| UX-008 | Archive System Transparency | Task Archive | Hidden data impact, session loss | **High** | Storage confusion, lost context | Open | 2025-08-20 |

## Priority Rationale

### Critical (Fix Immediately)
- **UX-003**: Navigation is broken - users literally don't know where they are or what app they're using
- **UX-001**: Dashboard is first impression - current state causes decision paralysis  
- **UX-006**: Diff viewer blocks core workflow - staging/unstaging is hidden behind mystery icons

### High (Fix Soon)
- **UX-004**: Sidebar is used constantly - 900 lines trying to do everything creates constant friction
- **UX-007**: Merge conflicts are high-stress moments - current UI adds to the stress instead of reducing it
- **UX-008**: Archive system lacks transparency - users don't understand storage impact (full project copies) or that sessions are lost

### Medium (Plan to Fix)
- **UX-005**: Projects page has issues but users don't spend much time there
- **UX-002**: Task Workspace complexity is intentional - needs careful balance, not wholesale simplification

## Common Anti-Patterns Identified

### 1. **Hidden Functionality Everywhere**
- Critical actions buried behind icons with no labels
- Hover-only reveals (Edit PLANNING.md)
- Dropdown menus hiding primary actions
- No tooltips on icon-only buttons

### 2. **Git Jargon Instead of Plain Language**
- "HEAD" instead of "Current Version"
- "Accept Current/Incoming" instead of "Keep My/Their Changes"
- "Staged" instead of "Ready to Save"
- Technical terms assuming Git expertise

### 3. **Everything Competes for Attention**
- No visual hierarchy - all elements same visual weight
- Too many status badges/indicators at once
- Multiple action buttons with no primary/secondary distinction
- Information overload on every screen

### 4. **Making Users Think**
- Cryptic IDs (#7b4) instead of clear labels
- Ambiguous icons (what does ⋮ do?)
- Inconsistent interaction patterns
- No clear next steps

## Quick Wins (Can Do Today)

### 1. **Add App Name to Header** (5 minutes)
```tsx
// Before: <div className="flex items-center gap-2">
// After:  <div className="flex items-center gap-2">
//           <span className="font-bold text-lg">PocketDev</span>
```

### 2. **Add Tooltips to All Icons** (30 minutes)
- Every icon-only button needs a tooltip
- Use consistent library (recommend Radix UI Tooltip)
- Include keyboard shortcuts in tooltips

### 3. **Fix Button Labels** (20 minutes)
- "Accept Current" → "Keep My Changes"
- "Accept Incoming" → "Use Their Changes"
- "HEAD" → "Current Version"
- "Working Tree" → "Your Changes"

### 4. **Show Disabled Instead of Hidden** (1 hour)
- Stop hiding buttons based on state
- Use disabled state with tooltip explaining why
- Maintains spatial consistency

## Krug's Principles Scorecard

| Principle | Current Score | Target | Most Violated By |
|-----------|--------------|--------|-------------------|
| Don't Make Me Think | 3/10 | 8/10 | Git terminology everywhere |
| Design for Scanning | 4/10 | 9/10 | No visual hierarchy |
| Make Choices Obvious | 3/10 | 8/10 | Hidden actions in icons |
| Omit Needless Words | 5/10 | 8/10 | Too much shown at once |
| Make It Self-Evident | 2/10 | 7/10 | No app identity, cryptic IDs |

## Recommended Action Plan

### Week 1: Critical Navigation & Wayfinding
1. Add PocketDev branding to header (UX-003)
2. Implement breadcrumb navigation (UX-003)
3. Fix Project Dashboard visual hierarchy (UX-001)
4. Make diff viewer actions visible (UX-006)

### Week 2: Reduce Cognitive Load
1. Simplify sidebar to focused components (UX-004)
2. Add plain language to merge conflicts (UX-007)
3. Implement tooltip system globally
4. Create consistent button hierarchy

### Week 3: Polish & Consistency
1. Fix projects page click targets (UX-005)
2. Add progressive disclosure to Task Workspace (UX-002)
3. Implement consistent hover states
4. Add loading skeletons instead of spinners

## Success Metrics

### Quantitative
- **Time to first action**: Reduce by 50%
- **Support questions**: Reduce "how do I...?" by 70%
- **Task completion rate**: Increase by 30%
- **Error rate**: Reduce misclicks by 60%

### Qualitative  
- Users stop asking "what does this button do?"
- New users productive within 5 minutes
- Power users can still access everything
- Interface "disappears" - users focus on work

## Testing Recommendations

### 5-Second Tests
Show interface for 5 seconds, ask:
1. What is this app for?
2. What would you click first?
3. Where are you in the app?

### First Click Tests
Give users tasks, measure:
1. Did they click the right thing?
2. How long did it take?
3. Did they hesitate?

### Think-Aloud Protocol
Watch users complete real tasks:
1. Where do they get stuck?
2. What makes them think?
3. What assumptions do they make?

## Design Principles Going Forward

### 1. **Make the Invisible Visible**
- Always show where users are (breadcrumbs)
- Show what buttons do (labels/tooltips)
- Show system state clearly

### 2. **Don't Make Me Think**
- Use plain language, not jargon
- Make clickable things look clickable
- One primary action per screen

### 3. **Progressive Disclosure**
- Start simple, add complexity as needed
- Hide advanced features behind "Advanced"
- Remember user preferences

### 4. **Respect the User**
- Don't hide things users need
- Provide escape hatches
- Make errors recoverable

## Review Schedule
- **Daily**: Check progress on critical UX fixes
- **Weekly**: Test with real users
- **Bi-weekly**: Measure success metrics
- **Monthly**: Reassess priorities

## Notes
- All UX issues reported on 2025-08-01 using Krug's principles
- Many issues interconnected - fixing navigation helps everything
- Quick wins can be done immediately while planning bigger fixes
- Consider creating a UX component library for consistency

---

*Created: 2025-08-01*  
*Last Updated: 2025-08-01*  
*Next Review: 2025-08-08*

## Remember Krug's Laws

1. **Don't make me think!** - If users have to figure it out, it's too complicated
2. **It doesn't matter how many times I have to click, as long as each click is a mindless, unambiguous choice**
3. **Get rid of half the words on each page, then get rid of half of what's left**
4. **Users don't read, they scan** - Design for scanning, not reading
5. **Users satisfice** - They choose the first reasonable option, not the best one