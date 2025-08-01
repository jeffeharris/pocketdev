# UX-001: Visual Hierarchy - Project Dashboard

## Problem Statement

The Project Dashboard violates Steve Krug's "Don't Make Me Think" principles by presenting all information with equal visual weight, forcing users to actively parse and prioritize content rather than having a clear visual hierarchy guide their attention.

## Current Issues

### 1. **No Clear Entry Point**
- Users don't know where to look first when landing on the dashboard
- "Needs Attention" and "Project Status" sections have identical visual weight
- Planning section takes 50% of screen real estate regardless of importance

### 2. **Competing Actions**
- Multiple action buttons (Pull, Push, Open Task, Archive, View PR) displayed simultaneously
- No visual hierarchy between primary and secondary actions
- Users must read and evaluate each option rather than having obvious next steps

### 3. **Information Overload**
- Everything is visible at once: attention items, planning docs, active tasks, recent activity
- No progressive disclosure - users see complex details before understanding basics
- Cognitive load from multiple status calculations happening behind the scenes

### 4. **Unclear Affordances**
- Task items don't immediately communicate they're clickable
- Settings button hidden in corner (violates "make important things obvious")
- "Edit PLANNING.md" only appears on hover - hidden functionality

### 5. **Inconsistent Interaction Patterns**
- Clicking tasks has unpredictable outcomes based on internal state
- Some actions stay on page (Pull/Push), others navigate away (Open Task)
- No clear mental model for user to predict behavior

## Impact on Users

1. **Decision Paralysis**: Too many equally-weighted options prevent quick action
2. **Cognitive Load**: Users must actively think about what to do next
3. **Missed Important Items**: Critical alerts can be overlooked in the visual noise
4. **Inefficient Workflows**: Users spend time orienting rather than acting

## Krug's Principles Being Violated

1. **"Don't Make Me Think"**: Users must actively parse and prioritize information
2. **"Design for Scanning"**: No clear visual hierarchy for quick scanning
3. **"Make Choices Obvious"**: All actions appear equally important
4. **"Omit Needless Words"**: Interface shows everything rather than what's needed now

## Proposed Solutions

### Immediate Fixes

1. **Create Visual Hierarchy**
   - Make "Needs Attention" visually dominant (larger, colored background, prominent position)
   - Reduce planning section to expandable summary by default
   - Use size, color, and spacing to guide the eye

2. **Prioritize Actions**
   - Show only primary action per attention item
   - Group secondary actions in dropdown/menu
   - Use button styling to indicate primary vs secondary

3. **Progressive Disclosure**
   - Start with overview, allow drilling into details
   - Collapse sections that aren't immediately relevant
   - Use accordions or tabs to organize content

### Longer-term Improvements

1. **Smart Defaults**
   - Auto-expand most relevant section based on context
   - Remember user preferences for layout
   - Adapt interface based on project state

2. **Guided Workflows**
   - Clear "next step" indicators
   - Breadcrumb trail showing where user is in process
   - Contextual help at decision points

3. **Reduce Cognitive Load**
   - Hide complex calculations, show simple status
   - Make click behaviors predictable
   - Use consistent patterns throughout

## Success Metrics

- Time to first action decreases
- Users report finding important information faster
- Fewer support questions about "what to do next"
- Increased task completion rates

## Related Issues

- Will impact TaskWorkspace design (even more complex)
- Connects to deep module philosophy - simple interface hiding complexity
- Relates to BUG-020 (terminal store exposing internal structure)

## Next Steps

1. Create mockups showing improved visual hierarchy
2. Test with users to validate assumptions
3. Implement in phases starting with "Needs Attention" section
4. Measure impact on user behavior

---

*Note: This is part of a broader UX improvement initiative based on Steve Krug's usability principles. The goal is to make PocketDev's interface so intuitive that users don't have to think about how to use it.*