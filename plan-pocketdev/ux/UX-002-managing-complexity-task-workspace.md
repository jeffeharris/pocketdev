# UX-002: Managing Complexity - Task Workspace

<!-- Document Metadata
Created: 2025-08-01
Modified: 2025-08-01
Status: ????
-->


## Problem Statement

The TaskWorkspace is necessarily complex - it's a power-user interface where developers manage multiple AI sessions, git operations, and file attachments. The challenge isn't to remove features, but to make the complexity *manageable* by following Krug's principle: "Get rid of half the words on each page, then get rid of half of what's left" - but applied to cognitive load, not features.

## Current Situation

The TaskWorkspace is designed to be a comprehensive workspace where users can:
- Run multiple AI sessions simultaneously (up to 6)
- View terminals in different configurations (tab/split/quad)
- Manage file attachments
- Perform git operations
- Monitor AI and git status

This is good! The issue is that all this capability is presented with equal visual weight, making it hard to focus.

## The Real Problem

It's not that there are too many features, but that:
1. **Everything competes for attention** - no clear visual hierarchy
2. **No "quiet mode"** - all indicators always visible even when not relevant
3. **Lack of progressive enhancement** - power features always visible even for simple tasks
4. **No visual grouping** - related functions scattered across the interface

## Krug-Inspired Solutions

### 1. **"Don't Make Me Think" - Smart Defaults**
- Start with the most common configuration (single terminal)
- Auto-expand to split view only when second terminal is opened
- Hide advanced features until they're relevant

### 2. **"Satisficing" - Help Users Find "Good Enough" Quickly**
- Make the primary terminal obviously primary
- Secondary terminals visually recede when not active
- Quick toggle to "focus mode" hiding all but active terminal

### 3. **Visual Hierarchy That Scales**
- **Active State**: Full brightness, full controls
- **Standby State**: Slightly dimmed, minimal controls
- **Minimized State**: Just a tab indicator
- User controls which terminals are in which state

### 4. **Ambient Information**
Instead of multiple competing indicators:
- Single "health" indicator that summarizes overall state
- Details available on hover/click
- Important changes briefly highlight then fade
- Critical issues break through with clear calls-to-action

### 5. **Contextual UI**
- Git controls only visible when there are changes
- File attachment indicator shows count, expands on click
- AI state indicators only prominent when waiting on AI
- "Zen mode" hides everything except terminal and essential controls

## Implementation Ideas

### Phase 1: Visual Hierarchy
- Active terminal gets blue border and full opacity
- Inactive terminals slightly transparent
- Status indicators use subtle colors unless critical
- Group related controls visually

### Phase 2: Progressive Disclosure
- Collapse panels that aren't actively used
- Remember user's preferred layout per task type
- Keyboard shortcuts for power users to bypass UI
- "Show me everything" toggle for when needed

### Phase 3: Smart Defaults
- Detect task type and suggest optimal layout
- Auto-minimize terminals that have been idle > 5 minutes
- Highlight terminal where AI just responded
- Smart focus management based on activity

## Success Metrics

- Users report feeling "in control" despite complexity
- Faster time to first AI interaction
- Fewer accidental actions in wrong terminal
- Power users can access everything, new users aren't overwhelmed

## The Balance

The goal is to support both:
1. **Novice users**: Who want to chat with one AI and commit changes
2. **Power users**: Who run 6 AIs simultaneously, comparing approaches

The interface should *scale* with user needs, not force everyone to see maximum complexity.

## Related Issues

- UX-001: Visual Hierarchy (similar principles, different page)
- The deep modules philosophy applies here - complex implementation, simple *default* interface

---

*Note: PocketDev is a power tool. The goal isn't to dumb it down, but to make the power accessible and manageable. As Krug says: "If you can't make something self-evident, you at least need to make it self-explanatory."*