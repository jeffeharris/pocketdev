# Split Views Technical Design Guide

## Executive Summary

This document provides the technical design for implementing split view functionality in PocketDev, allowing users to view multiple terminal sessions simultaneously within a single task. Based on the requirements and current architecture analysis, I present implementation options with recommendations.

## Current State Analysis

### Multi-Terminal Architecture (Completed)
- **Backend**: Phase 1 complete with support for multiple Shelltender sessions per task
- **Frontend**: `TerminalTabs` component manages tab-based navigation
- **Database**: `terminal_sessions` table supports `tab_name` and `tab_order` fields
- **WebSocket**: Real-time state updates for each terminal session

### Key Challenges Identified
1. **Session ID Complexity**: Three different session ID fields causing confusion
2. **State Management**: Terminal state is prop-drilled through multiple components
3. **Performance**: Multiple xterm.js instances will need careful resource management
4. **Layout Persistence**: No current mechanism for saving view configurations

## Design Decisions & Options

### 1. Layout Management Architecture

**Option A: CSS Grid-Based Layout (Recommended)**
- Use CSS Grid for flexible 2x2 layouts
- Pros: Native browser support, responsive, minimal JS overhead
- Cons: Limited to grid patterns

**Option B: Flexbox Nested Layout**
- Nested flex containers for arbitrary splits
- Pros: More flexible layouts possible
- Cons: Complex resizing logic, performance overhead

**Option C: Third-Party Layout Library (react-mosaic)**
- Use existing split pane library
- Pros: Feature-rich, handles edge cases
- Cons: Additional dependency, may conflict with existing styles

**Recommendation**: Start with Option A for Phase 1 (2-way splits), architecture supports Option C migration if needed.

### 2. State Management Solution

**Option A: Zustand Store (Recommended)**
```typescript
interface SplitViewStore {
  layouts: Map<string, LayoutConfig>; // taskId -> layout
  activeLayout: LayoutConfig | null;
  setLayout: (taskId: string, layout: LayoutConfig) => void;
  toggleSplitView: (taskId: string) => void;
}
```
- Pros: Lightweight, TypeScript-friendly, minimal boilerplate
- Cons: New dependency

**Option B: React Context + useReducer**
- Pros: No new dependencies, React native
- Cons: More boilerplate, prop drilling for dispatch

**Option C: Extend Existing WebSocket State**
- Pros: Leverages existing infrastructure
- Cons: Mixes concerns, not ideal for UI state

**Recommendation**: Option A provides clean separation of concerns and better developer experience.

### 3. Terminal Instance Management

**Option A: Lazy Terminal Rendering (Recommended)**
```typescript
interface TerminalInstance {
  sessionId: string;
  xtermInstance?: Terminal; // Only create when visible
  buffer: string[]; // Cache output when not visible
}
```
- Keep only visible terminals fully rendered
- Cache output for hidden terminals
- Pros: Better performance, lower memory usage
- Cons: Slight delay when switching views

**Option B: All Terminals Active**
- Keep all xterm instances alive
- Pros: Instant switching
- Cons: High memory usage, potential performance issues

**Recommendation**: Option A scales better and aligns with performance requirements.

## Proposed Architecture

### Frontend Components

```
TerminalPanel (modified)
├── SplitViewControls
│   ├── LayoutToggle (2-way, 4-way, tabs)
│   ├── SplitOrientation (horizontal/vertical)
│   └── MaximizeButton
├── SplitViewContainer
│   ├── SplitPane (recursive for nested splits)
│   │   ├── TerminalRenderer
│   │   └── ResizeDivider
│   └── TabView (fallback for mobile)
└── TerminalTabs (existing, shown in split mode)
```

### Data Models

```typescript
// Layout Configuration
interface LayoutConfig {
  mode: 'tabs' | 'split-2' | 'split-4';
  orientation?: 'horizontal' | 'vertical';
  sizes: number[]; // Percentage sizes for each pane
  terminals: string[]; // Session IDs in order
}

// Extended Terminal Session
interface TerminalSessionState {
  sessionId: string;
  dbSessionId: string;
  isVisible: boolean;
  hasFocus: boolean;
  viewportState?: {
    scrollPosition: number;
    cursorPosition: { x: number; y: number };
  };
}
```

### Database Schema Extension

```sql
-- Option 1: JSON in tasks table (Recommended for Phase 1)
ALTER TABLE tasks ADD COLUMN split_layout JSON;

-- Option 2: Separate layout table (For Phase 2 with cross-project views)
CREATE TABLE terminal_layouts (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    user_id TEXT, -- For future user-specific layouts
    layout_config JSON NOT NULL,
    is_default BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

### WebSocket Events

New events for split view coordination:

```typescript
// Client -> Server
'split-view:toggle': { taskId: string; mode: string }
'split-view:resize': { taskId: string; sizes: number[] }
'split-view:focus': { taskId: string; sessionId: string }

// Server -> Client (broadcast)
'split-view:layout-changed': { taskId: string; layout: LayoutConfig }
'split-view:terminal-focused': { taskId: string; sessionId: string }
```

## Implementation Phases

### Phase 1: Basic 2-Way Splits (1-2 weeks)

1. **Backend** (2-3 days)
   - Add `split_layout` column to tasks table
   - Create layout management endpoints
   - Add WebSocket event handlers

2. **Frontend** (4-5 days)
   - Create SplitViewContainer with CSS Grid
   - Implement lazy terminal rendering
   - Add keyboard navigation (Ctrl+Shift+Arrows)
   - Mobile responsive collapse

3. **Testing & Polish** (2-3 days)
   - Performance testing with 2 active terminals
   - Responsive design verification
   - Keyboard shortcut testing

### Phase 2: Quad View Extension (3-4 days)

1. **Extend Layout System**
   - Support 2x2 grid configuration
   - Enhanced resize logic for 4 panes
   - Smart terminal arrangement

2. **Performance Optimization**
   - Implement viewport-based rendering
   - Add render throttling for unfocused terminals

### Future: Cross-Project Views (Not in initial scope)

- Separate layouts table
- Project-agnostic terminal management
- Custom layout builder UI

## Performance Considerations

### Memory Management
```typescript
// Terminal lifecycle hooks
const useTerminalLifecycle = (sessionId: string, isVisible: boolean) => {
  useEffect(() => {
    if (isVisible && !terminalInstance) {
      // Create xterm instance
      createTerminal(sessionId);
    } else if (!isVisible && terminalInstance) {
      // Suspend but don't destroy
      suspendTerminal(sessionId);
    }
  }, [isVisible]);
};
```

### Render Optimization
- Use `React.memo` for terminal panes
- Implement viewport intersection observer
- Throttle resize events to 60fps
- Debounce layout persistence

## Migration Strategy

1. **Preserve Existing Functionality**
   - Tabs remain default view
   - Split view is opt-in per task
   - No breaking changes to API

2. **Feature Flag Rollout**
   ```typescript
   const FEATURES = {
     SPLIT_VIEW: process.env.REACT_APP_ENABLE_SPLIT_VIEW === 'true'
   };
   ```

3. **Gradual Enhancement**
   - Start with 2-way splits
   - Monitor performance metrics
   - Add quad view based on usage

## Security & Constraints

- **Input Sanitization**: Layout configs must be validated
- **Resource Limits**: Max 4 terminals per split view
- **Browser Compatibility**: Requires ResizeObserver API
- **Mobile**: Auto-collapse to tabs below 768px

## Testing Strategy

### Unit Tests
- Layout calculation logic
- State management stores
- Keyboard navigation handlers

### Integration Tests
- WebSocket event flow
- Terminal creation/destruction
- Layout persistence

### E2E Tests
- Split view activation
- Resize interactions
- Focus management
- Mobile responsiveness

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance degradation with 4 terminals | High | Lazy rendering, viewport optimization |
| Complex resize logic bugs | Medium | Start simple with 2-way, extensive testing |
| WebSocket message storm | Medium | Debounce resize events, batch updates |
| Memory leaks from terminals | High | Proper cleanup hooks, instance tracking |

## Decision Summary

1. **Use CSS Grid** for layout management (simple, performant)
2. **Implement Zustand store** for split view state (clean architecture)
3. **Lazy render terminals** (scalability)
4. **Store layouts in tasks table** initially (simplicity)
5. **Phase approach** starting with 2-way splits (risk reduction)

## Next Steps

1. Review and approve technical design
2. Create detailed component specifications
3. Set up feature flag infrastructure
4. Begin Phase 1 implementation with backend work

## Questions for Clarification

1. **Session ID Consolidation**: Should we address the three session ID fields as part of this work or separately?
2. **Performance Metrics**: What specific FPS/memory targets should we validate against?
3. **Keyboard Shortcuts**: Any preference for the specific key combinations beyond Ctrl+Shift+Arrows?
4. **Layout Persistence**: Should layouts persist across browser sessions immediately or can this be Phase 2?
5. **AI State Aggregation**: Should split view show a combined AI state indicator anywhere?