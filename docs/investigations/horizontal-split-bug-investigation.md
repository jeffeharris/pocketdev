# Horizontal Split View Animation Bug Investigation Report

<!-- Document Metadata
Created: 2025-08-03
Modified: 2025-08-03
Status: ????
-->


## Summary
When switching to horizontal split mode, the divider line starts at the bottom of the screen and animates upward but doesn't reach the center (50% position). After a page refresh, it displays correctly at 50%.

## Key Findings

### 1. CSS Transitions Are Disabled
The CSS explicitly disables ALL transitions and animations:
- `TerminalPanel.css` line 7: `transition: none !important;`
- Lines 11-14: All children have `transition: none !important; animation: none !important;`

**Conclusion**: The "animation" is NOT a CSS transition - it's the browser recalculating layout.

### 2. Grid Layout Implementation
- **Vertical split** (working): Uses `grid-template-columns: var(--split-ratio, 50%) calc(100% - var(--split-ratio, 50%));`
- **Horizontal split** (buggy): Uses `grid-template-rows: var(--split-ratio, 50%) calc(100% - var(--split-ratio, 50%));`
- Both use the same CSS custom property approach: `--split-ratio: ${layout.splitRatio * 100}%`

### 3. Container Structure
The terminal container has these key CSS properties:
- `flex-1` - Takes remaining height in flex container
- `min-h-0` - Allows shrinking below content size
- `overflow-hidden` - Clips content
- `relative` - For absolute positioning of overlays

### 4. Critical Difference: Height vs Width Calculation
The browser calculates height differently than width in CSS Grid:
- **Width calculation** is immediate and accurate
- **Height calculation** can be deferred, especially with `flex-1` containers

## Root Cause Analysis

### The Problem
1. When switching to horizontal split, the container's height isn't fully calculated yet
2. The grid tries to calculate `grid-template-rows` based on percentage of an unknown/zero height
3. The browser places content at the bottom (default behavior when grid rows can't be calculated)
4. As the flex container resolves its height, the browser recalculates, creating the "animation" effect

### Why It Works After Refresh
On page refresh:
- The container already has a calculated height from the previous render
- Grid can immediately calculate proper row heights
- No recalculation needed

### Why Vertical Split Works
- Width is typically known immediately (block-level elements take full width)
- No dependency on flex calculations
- Grid can calculate columns immediately

## Evidence Supporting This Theory

1. **DirectTerminal Component** uses `requestAnimationFrame` to delay mounting until DOM is painted
2. **Container monitoring** exists (`ResizeObserver` in DirectTerminal) suggesting height calculation issues
3. **Flex container with `min-h-0`** is a common pattern that causes height calculation delays

## Recommended Solutions

### Solution 1: Force Height Calculation (Quick Fix)
```typescript
// In TerminalPanel.tsx, after updateLayout({ orientation: 'horizontal' })
if (terminalContainerRef.current) {
  // Force browser to calculate height
  const height = terminalContainerRef.current.offsetHeight;
  // Trigger reflow
  terminalContainerRef.current.style.display = 'none';
  terminalContainerRef.current.offsetHeight; // Force reflow
  terminalContainerRef.current.style.display = '';
}
```

### Solution 2: Use Fixed Height Units (Better)
Instead of percentage-based grid rows, use `fr` units:
```css
.terminals-container.mode-split.orientation-horizontal {
  grid-template-rows: 1fr 1fr; /* Equal height rows */
}
```
Then apply the split ratio using a different method.

### Solution 3: Delay Grid Application (Workaround)
```typescript
// Set grid after a microtask to ensure height is calculated
Promise.resolve().then(() => {
  updateLayout({ orientation: 'horizontal' });
});
```

### Solution 4: Use Explicit Height (Most Reliable)
Set an explicit height on the container before applying grid:
```typescript
const container = terminalContainerRef.current;
if (container) {
  const height = container.getBoundingClientRect().height;
  container.style.height = `${height}px`;
  updateLayout({ orientation: 'horizontal' });
  // Remove explicit height after layout stabilizes
  requestAnimationFrame(() => {
    container.style.height = '';
  });
}
```

## Testing Strategy

1. Add console logs to track container height during mode switches
2. Use Chrome DevTools to watch computed `grid-template-rows` value
3. Check if `--split-ratio` custom property is set correctly
4. Monitor when the grid recalculates (Performance tab)

## Conclusion

This is a browser layout calculation timing issue specific to CSS Grid with percentage-based rows in a flex container. The "animation" is the browser recalculating layout as the container's height becomes known. The issue doesn't occur with columns (vertical split) because width is typically calculated immediately.