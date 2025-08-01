# Tab Sizing Guidelines

## Best Practices for Dynamic Tab Sizing

### Browser Tab Behavior References
Modern browsers use dynamic tab sizing strategies:

1. **Chrome/Edge**: 
   - Tabs shrink proportionally as more are added
   - Minimum width before scrolling (approximately 10-15% of tab bar width)
   - Pinned tabs have fixed small width
   
2. **Firefox**:
   - Similar to Chrome but with slightly different minimum width
   - Smooth transitions when adding/removing tabs
   
3. **VS Code**:
   - Fixed minimum width with horizontal scrolling
   - Scroll arrows appear when tabs overflow
   - Active tab always visible (auto-scrolls)

### Recommended Approach for PocketDev

```css
/* Flexible Grid Approach */
.tab-bar {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none; /* Hide scrollbar */
}

.tab {
  flex: 1 1 auto;
  min-width: min(150px, 25%); /* Dynamic minimum based on container */
  max-width: 250px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

/* When tabs are few, they size to content */
.tab-bar:has(.tab:nth-child(-n+3)) .tab {
  flex: 0 1 auto;
}

/* Compress when many tabs */
.tab-bar:has(.tab:nth-child(5)) .tab {
  flex: 1 1 0;
}
```

### Dynamic Sizing Algorithm

1. **Calculate available space**: 
   - Container width - plus button width - padding

2. **Determine sizing mode**:
   - **Few tabs (1-3)**: Size to content with max-width constraint
   - **Medium tabs (4-5)**: Distribute space equally
   - **Many tabs (6)**: Minimum viable width with scroll

3. **Handle overflow**:
   - Show scroll arrows when tabs don't fit
   - Ensure active tab is always visible
   - Smooth scroll to new tabs

### Responsive Considerations

- **Desktop (>1200px)**: Full dynamic sizing
- **Tablet (768-1200px)**: Earlier compression, smaller max-width
- **Mobile (<768px)**: Fixed small width, immediate scrolling

### Implementation Example

```typescript
const calculateTabWidth = (
  containerWidth: number,
  tabCount: number,
  plusButtonWidth: number = 40
): { tabWidth: number; enableScroll: boolean } => {
  const availableWidth = containerWidth - plusButtonWidth - 16; // padding
  const contentWidth = 180; // Ideal content width
  const minWidth = Math.min(150, containerWidth * 0.25); // Dynamic minimum
  
  // Few tabs: use content width
  if (tabCount <= 3) {
    return {
      tabWidth: Math.min(contentWidth, availableWidth / tabCount),
      enableScroll: false
    };
  }
  
  // Many tabs: check if minimum width fits
  const widthPerTab = availableWidth / tabCount;
  if (widthPerTab < minWidth) {
    return {
      tabWidth: minWidth,
      enableScroll: true
    };
  }
  
  // Medium tabs: distribute equally
  return {
    tabWidth: widthPerTab,
    enableScroll: false
  };
};
```

### Visual States

1. **Normal**: Full tab name visible
2. **Compressed**: Some text truncation
3. **Minimum**: Icon + truncated text
4. **Scrolling**: Fixed minimum width

### Accessibility

- Ensure full tab names are available via:
  - Hover tooltips
  - Screen reader labels
  - Focus indicators that expand to show full name
- Keyboard navigation must work with scroll
- Clear visual feedback for active/inactive states