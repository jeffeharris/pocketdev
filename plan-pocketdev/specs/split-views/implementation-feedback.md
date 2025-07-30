# Split Views Implementation Feedback

## Current State Assessment

After reviewing the multi-terminal tabs implementation, here's my feedback and recommendations for the split views feature:

### ✅ Strong Foundation Already in Place

1. **Split View Infrastructure Already Started**
   - `SplitViewContainer.tsx` and `SplitViewControls.tsx` exist
   - Basic split view store with state management
   - Feature flag (`VITE_FEATURE_SPLIT_VIEW`) for gradual rollout
   - Drag-to-resize functionality implemented
   - Double-click to reset ratio (50/50) implemented

2. **Clean Terminal Architecture**
   - `DirectTerminal` component properly encapsulates xterm.js instances
   - Terminal refs management for focus handling
   - Memoization to prevent unnecessary re-renders
   - Good separation between database session IDs and Shelltender session IDs

3. **State Management**
   - Zustand stores for terminal and split view state
   - WebSocket event handling for real-time updates
   - Layout persistence to localStorage (already implemented!)

### 🚧 Areas Needing Attention

1. **Focus Management Complexity**
   - Current focus handling uses a workaround for xterm.js textarea selection
   - Split view will need careful coordination of focus between multiple terminals
   - Keyboard navigation (Ctrl+Shift+Arrow) needs implementation

2. **Performance Considerations**
   - Multiple xterm.js instances can be CPU-intensive
   - Need throttling for unfocused terminals (REQ-SV-011)
   - Current implementation doesn't lazy-render terminals outside viewport

3. **Responsive Design**
   - Auto-collapse to tabs below 768px not fully implemented
   - Touch-friendly resize handles needed for tablet support

### 📋 Implementation Recommendations

#### Phase 1: Complete Basic 2-Way Splits

1. **Leverage Existing Code**
   - The `SplitViewContainer` already supports horizontal/vertical orientation
   - Focus on stabilizing the existing implementation rather than rewriting
   - Add keyboard shortcuts using the existing `useShortcutContext` hook

2. **Fix Current Issues**
   ```typescript
   // In SplitViewContainer.tsx, add proper cleanup for terminals
   useEffect(() => {
     return () => {
       // Dispose of xterm instances when unmounting
       primaryRef.current?.dispose?.();
       secondaryRef.current?.dispose?.();
     };
   }, []);
   ```

3. **Add Missing Features**
   - Terminal panel headers showing session names (REQ-SV-016)
   - Visual focus indicators with theme colors (REQ-SV-014)
   - Keyboard navigation between panes

#### Phase 2: Performance Optimizations

1. **Implement Render Throttling**
   ```typescript
   // Add to DirectTerminal props
   interface DirectTerminalProps {
     // ... existing props
     throttleUpdates?: boolean; // For unfocused terminals
   }
   ```

2. **Add ResizeObserver Check**
   - Graceful degradation for older browsers
   - Already have container refs to implement this

#### Phase 3: Quad View (Quick Follow-on)

1. **Extend Existing Architecture**
   - Change split store to support 4 terminal IDs instead of 2
   - Add grid layout option to orientation enum
   - Reuse existing resize logic for both dividers

### 🏗️ Architecture Recommendations

1. **Keep It Simple**
   - Don't over-engineer for cross-project support yet
   - Focus on making 2-way splits rock-solid first
   - The existing architecture can easily extend to quad view

2. **Reuse Existing Patterns**
   - Terminal focus management already works in tabs
   - WebSocket synchronization is proven
   - State persistence pattern is established

3. **Testing Strategy**
   - Good test coverage exists for stores
   - Add integration tests for split view scenarios
   - Test performance with 4 concurrent terminals

### ⚠️ Risk Mitigation

1. **Memory Leaks**
   - Ensure proper disposal of xterm.js instances
   - Clean up event listeners and WebSocket subscriptions
   - Monitor with Chrome DevTools Memory Profiler

2. **Browser Compatibility**
   - Test ResizeObserver availability
   - Fallback to tab mode on unsupported browsers
   - Consider polyfills if needed

3. **User Experience**
   - Start with feature flag enabled only for power users
   - Gather feedback before general release
   - Consider A/B testing different layouts

## Summary

The team has already built a solid foundation for split views. The architecture is sound, and much of the infrastructure exists. Focus should be on:

1. Stabilizing the existing split view implementation
2. Adding the missing UI elements (headers, focus indicators)
3. Implementing keyboard navigation
4. Performance optimizations for multiple terminals

The phased approach in the requirements makes sense. Start with 2-way splits, ensure they're performant and intuitive, then extend to quad view as a natural evolution of the same architecture.