# 4-Way (Quad) View Implementation Considerations

<!-- Document Metadata
Created: 2025-07-30
Modified: 2025-07-30
Status: ????
-->


## Critical Considerations Before Implementation

### 1. 🏗️ Data Model Refactoring Required

The current `SplitLayoutConfig` only supports 2 terminals:
```typescript
interface SplitLayoutConfig {
  primaryTerminalId: string | null;
  secondaryTerminalId: string | null;
  splitRatio: number;  // Single ratio won't work for quad
}
```

**Simplified Approach** - Extend existing model minimally:
```typescript
interface SplitLayoutConfig {
  mode: 'tab' | 'split-2' | 'split-4';
  orientation: 'horizontal' | 'vertical' | 'grid';  // Add 'grid'
  
  // Keep existing for backwards compatibility
  primaryTerminalId: string | null;
  secondaryTerminalId: string | null;
  
  // Add for quad view
  tertiaryTerminalId?: string | null;
  quaternaryTerminalId?: string | null;
  
  splitRatio: number;  // For 2-way
  verticalRatio?: number;  // For quad (if we add resizing later)
}
```

This maintains backward compatibility while enabling quad view.

### 2. 🎯 Focus Management Complexity

**Current State**: 2-way split tracks primary/secondary
**Quad Challenge**: Need to track focus across 4 panes with:
- Logical navigation order (clockwise? reading order?)
- Visual focus indicators for all 4 states
- Keyboard shortcuts that make sense spatially

**Recommendation**: Implement robust focus management for 2-way first, then extend pattern.

### 3. ⚡ Performance Thresholds

**Critical Performance Testing Needed**:
- 4 concurrent xterm.js instances with active output
- Memory usage baseline (each terminal ~10-20MB)
- CPU usage during simultaneous updates
- WebSocket connection pooling limits

**Before quad view**: 
1. Implement REQ-SV-011 (throttle unfocused terminals)
2. Benchmark 2-way split under load
3. Set performance gates (e.g., maintain 30fps with 1000 lines/sec)

### 4. 🖥️ Minimum Viewport Requirements

**Current**: 768px collapse threshold works for 2-way
**Quad Reality**: 
- Each terminal needs ~400px width minimum for usability
- 4-way realistically needs 1600px+ width
- Height considerations for stacked layout

**Recommendation**: Define separate breakpoints:
- < 768px: Tab only
- 768-1200px: 2-way split only
- 1200px+: Enable quad option

### 5. 🔄 Resize Handle Complexity

**Current**: Single divider with one drag handle
**Simplified Solution**: Equal quadrants only (no resizing)

Benefits:
- No complex resize interactions
- CSS Grid handles layout automatically
- Can add resizing as future enhancement
- Users can double-click to temporarily maximize a quadrant

**Implementation**: Just use `grid-cols-2 grid-rows-2` and done!

### 6. 🎨 UI/UX Considerations

**Visual Hierarchy Issues**:
- 4 terminals compete for attention
- Need clear "active quadrant" indicator
- Terminal headers become crucial for orientation
- Consider subtle backgrounds/borders per quadrant

**Interaction Patterns**:
- Click to focus (current) may feel sluggish with 4 panes
- Consider hover-to-preview interactions
- Need "maximize pane" temporary action

### 7. 🔌 Backend/WebSocket Scaling

**Current**: Manages N terminals but optimized for 2-3
**Quad Concerns**:
- 4x WebSocket traffic to Shelltender
- Session state broadcasting overhead
- Potential connection limit issues

**Pre-work needed**:
- Profile WebSocket message frequency
- Consider batching updates
- Implement connection pooling if needed

### 8. 📱 Responsive Design Strategy

**Graceful Degradation Path**:
```
Mobile (<768px) → Tabs only
Tablet (768-1200px) → 2-way split max
Desktop (1200-1600px) → 2-way split recommended
Large Desktop (1600px+) → Quad view available
```

### 9. 🧪 Testing Complexity

**Exponential Test Cases**:
- 4 terminals × 4 focus states × resize interactions
- Cross-terminal keyboard navigation
- Session lifecycle (what if 1 of 4 disconnects?)
- Performance regression tests

**Recommendation**: Comprehensive 2-way test suite first.

### 10. 🚀 Migration Path

**Data Migration Needed**:
- Existing split layouts in localStorage
- User preferences compatibility
- Graceful handling of old format

## Recommended Pre-Implementation Checklist

### Simplified Pre-Quad Checklist
- [x] Performance validated (2000 lines/min tested successfully)
- [ ] Complete 2-way keyboard shortcuts
- [ ] Add full screen mode toggle
- [ ] Implement feature flag for quad view
- [ ] Add viewport size detection (1400x800 minimum)

### Architecture Decisions (Simplified)
1. **Resize Model**: ✅ Equal quadrants only (no resizing)
2. **Focus Model**: ✅ Tab/Shift+Tab for cycling
3. **Layout Persistence**: ✅ Extend current model with 2 new fields
4. **Performance Strategy**: ✅ Already proven acceptable
5. **Activation**: ✅ Full screen mode only

### Implementation Steps
1. Add `'split-4'` mode to existing types
2. Add tertiary/quaternary terminal IDs
3. Create grid layout in SplitViewContainer
4. Add full screen toggle button
5. Implement Tab navigation for 4 panes
6. Ship behind feature flag

## Risk Assessment

**High Risk**:
- Performance degradation making app unusable
- Complex interactions confusing users
- Memory leaks with 4x terminal instances

**Medium Risk**:
- WebSocket connection limits
- Browser compatibility issues
- Increased bug surface area

**Low Risk**:
- Visual design challenges
- Documentation complexity

## Recommendation

### Original Conservative Approach
The initial recommendation was to **wait** until 2-way split is proven with 1000+ users. However...

### Simplified Approach Changes Everything
With the simplified implementation plan:
- ✅ Performance already validated (2000 lines/min works fine)
- ✅ Full screen mode eliminates space constraints
- ✅ Equal quadrants remove resize complexity
- ✅ CSS Grid handles layout automatically
- ✅ Minimal code changes required

### Revised Recommendation
**Quad view can be implemented sooner** with these constraints:
1. **Full screen only** - Simplifies space management
2. **Equal quadrants** - No resize complexity
3. **Feature flag** - Ship as experimental first
4. **Minimum viewport** - 1400x800px required
5. **Grid layout** - Let CSS do the work

### Implementation Timeline
1. **Week 1**: Complete 2-way keyboard shortcuts
2. **Week 2**: Add quad view behind feature flag
3. **Week 3**: Internal testing with power users
4. **Week 4**: Refine and ship

The simplified approach reduces quad view from a complex architectural change to essentially a new CSS layout mode. This is indeed "not rocket science" - just practical engineering.