# Phase 1 Implementation Plan: 2-Way Split Views

<!-- Document Metadata
Created: 2025-07-29
Modified: 2025-07-29
Status: ????
-->


## Overview

With all viability tests passing, we proceed with Phase 1: implementing 2-way (horizontal/vertical) split views. This plan provides concrete steps, time estimates, and success criteria.

## Success Criteria for Phase 1

- [ ] Users can toggle between tab view and 2-way split view
- [ ] Split orientation switchable (horizontal/vertical)
- [ ] Resize divider works smoothly
- [ ] Keyboard navigation between panes
- [ ] Layout persists across page refreshes
- [ ] Mobile auto-collapses to tabs
- [ ] Performance remains above 30 FPS

## Implementation Steps

### Step 1: Backend Foundation (Day 1)

#### 1.1 Database Migration
```sql
-- Migration: 004_split_view_layouts.sql
ALTER TABLE tasks ADD COLUMN split_layout JSON DEFAULT NULL;

-- Example layout structure:
-- {
--   "mode": "split-2",
--   "orientation": "horizontal",
--   "sizes": [50, 50],
--   "terminals": ["session-id-1", "session-id-2"],
--   "focusedTerminal": "session-id-1"
-- }
```

#### 1.2 API Endpoints
```typescript
// PATCH /api/tasks/:taskId/split-layout
// Body: { layout: LayoutConfig }

// GET /api/tasks/:taskId/split-layout
// Returns: { layout: LayoutConfig | null }
```

#### 1.3 WebSocket Events
```typescript
// backend/websocket/split-view-handlers.js
- 'split-view:update-layout'
- 'split-view:layout-updated' (broadcast)
```

### Step 2: Feature Flag Setup (Day 1)

#### 2.1 Environment Configuration
```bash
# .env
REACT_APP_FEATURE_SPLIT_VIEW=true
```

#### 2.2 Feature Flag Hook
```typescript
// frontend/src/hooks/useFeatureFlags.ts
export const useFeatureFlags = () => {
  return {
    splitView: process.env.REACT_APP_FEATURE_SPLIT_VIEW === 'true'
  };
};
```

### Step 3: State Management (Day 2)

#### 3.1 Install Zustand
```bash
cd frontend && npm install zustand
```

#### 3.2 Create Split View Store
```typescript
// frontend/src/stores/splitViewStore.ts
interface SplitViewState {
  layouts: Map<string, LayoutConfig>;
  getLayout: (taskId: string) => LayoutConfig | null;
  updateLayout: (taskId: string, layout: LayoutConfig) => void;
  toggleSplitMode: (taskId: string) => void;
}
```

### Step 4: Core Components (Days 2-3)

#### 4.1 SplitViewContainer
```typescript
// frontend/src/components/terminal/SplitViewContainer.tsx
- CSS Grid-based layout
- Dynamic grid-template based on orientation
- Handles 2 terminals only for Phase 1
```

#### 4.2 SplitViewControls
```typescript
// frontend/src/components/terminal/SplitViewControls.tsx
- Toggle button (tabs/split)
- Orientation toggle (horizontal/vertical)
- Visual indicators for current mode
```

#### 4.3 ResizeDivider
```typescript
// frontend/src/components/terminal/ResizeDivider.tsx
- Draggable divider component
- Mouse and touch support
- Visual feedback during drag
```

### Step 5: Terminal Integration (Day 4)

#### 5.1 Modify TerminalPanel
```typescript
// Add split view rendering path
if (splitViewMode && terminals.length >= 2) {
  return <SplitViewContainer />;
}
return <ExistingTabView />;
```

#### 5.2 Lazy Terminal Rendering
```typescript
// Only create xterm instances for visible terminals
// Cache terminal state when switching views
```

### Step 6: Keyboard Navigation (Day 4)

```typescript
// Keyboard shortcuts:
- Ctrl+Shift+D: Toggle split orientation
- Ctrl+Shift+← / →: Move focus between panes
- Escape: Exit split view
```

### Step 7: Responsive Design (Day 5)

```typescript
// Auto-collapse to tabs on mobile
const isMobile = window.innerWidth < 768;
if (isMobile && splitViewMode) {
  // Force tab view
}
```

### Step 8: Testing & Polish (Days 5-6)

#### 8.1 Unit Tests
- [ ] Store logic tests
- [ ] Layout calculation tests
- [ ] Resize handler tests

#### 8.2 Integration Tests
- [ ] WebSocket event flow
- [ ] Layout persistence
- [ ] Terminal lifecycle

#### 8.3 Manual Testing Checklist
- [ ] Create task with 2 terminals
- [ ] Toggle split view
- [ ] Switch orientation
- [ ] Resize panes
- [ ] Test keyboard navigation
- [ ] Refresh page (layout persists)
- [ ] Test on mobile (auto-collapse)
- [ ] Monitor performance

## File Structure

```
frontend/src/
├── components/terminal/
│   ├── SplitViewContainer.tsx      (new)
│   ├── SplitViewControls.tsx       (new)
│   ├── ResizeDivider.tsx           (new)
│   ├── TerminalPanel.tsx           (modified)
│   └── TerminalTabs.tsx            (existing)
├── stores/
│   └── splitViewStore.ts           (new)
├── hooks/
│   └── useFeatureFlags.ts          (new)
└── types/
    └── splitView.ts                (new)

backend/
├── db/migrations/
│   └── 004_split_view_layouts.sql  (new)
├── controllers/
│   └── taskController.js           (modified)
└── websocket/
    └── split-view-handlers.js      (new)
```

## Performance Monitoring

Track these metrics during implementation:
- FPS during resize operations
- Memory usage with 2 terminals
- Time to switch between views
- WebSocket message latency

## Definition of Done

- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing checklist complete
- [ ] Performance metrics meet targets
- [ ] Code review completed
- [ ] Documentation updated

## Rollback Plan

If issues arise:
1. Feature flag can disable split view instantly
2. Database migration is backward compatible (nullable column)
3. No breaking changes to existing tab functionality

## Phase 2 Preview

After Phase 1 is stable (1-2 weeks in production):
- Extend to 4-way split (2x2 grid)
- Add advanced layouts
- Custom layout persistence
- Cross-task terminal views

## Daily Standup Format

Track progress with:
- What was completed yesterday
- What's planned for today
- Any blockers
- Performance metrics
- User feedback (if any)

---

Ready to begin implementation. First action: Create database migration and feature flag.