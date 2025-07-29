# Split Views Implementation Checklist

## Pre-Implementation
- [x] Technical design document
- [x] Risk analysis
- [x] Viability tests (all passed)
- [x] Phase 1 implementation plan
- [x] Create feature branch

## Phase 1: 2-Way Splits (6 days)

### Day 1: Backend Foundation
- [ ] Create database migration (004_split_view_layouts.sql)
- [ ] Add split_layout column to tasks table
- [ ] Implement PATCH /api/tasks/:taskId/split-layout endpoint
- [ ] Implement GET /api/tasks/:taskId/split-layout endpoint
- [ ] Add WebSocket handlers for layout events
- [ ] Set up feature flag in .env files

### Day 2: State Management & Components
- [ ] Install Zustand
- [ ] Create splitViewStore
- [ ] Build SplitViewContainer component
- [ ] Build SplitViewControls component
- [ ] Create TypeScript types for split views

### Day 3: Layout & Resize
- [ ] Implement CSS Grid layout system
- [ ] Build ResizeDivider component
- [ ] Add drag-to-resize functionality
- [ ] Implement resize constraints (min/max sizes)
- [ ] Add resize performance optimizations

### Day 4: Terminal Integration
- [ ] Modify TerminalPanel for split view mode
- [ ] Implement lazy terminal rendering
- [ ] Handle terminal lifecycle in splits
- [ ] Add keyboard navigation (Ctrl+Shift+Arrows)
- [ ] Implement focus management

### Day 5: Polish & Responsive
- [ ] Add split view animations/transitions
- [ ] Implement mobile responsive collapse
- [ ] Add visual indicators for active terminal
- [ ] Implement layout persistence
- [ ] Add error handling

### Day 6: Testing & Documentation
- [ ] Write unit tests for store
- [ ] Write component tests
- [ ] Integration testing
- [ ] Performance testing
- [ ] Update user documentation
- [ ] Code review

## Quality Gates

### Before Proceeding to Each Day
- [ ] Previous day's work is tested
- [ ] No regression in existing features
- [ ] Performance metrics still passing

### Before Marking Phase 1 Complete
- [ ] All checklist items done
- [ ] Manual testing passed
- [ ] Performance: 30+ FPS maintained
- [ ] Memory: <500MB for 2 terminals
- [ ] Zero errors in console
- [ ] Feature flag tested (on/off)

## Post-Implementation
- [ ] Monitor for 1 week
- [ ] Gather user feedback
- [ ] Document lessons learned
- [ ] Plan Phase 2 (4-way splits)

## Emergency Procedures
- Feature flag to disable: `REACT_APP_FEATURE_SPLIT_VIEW=false`
- Rollback migration if needed
- Revert to previous commit if critical issues

## Success Metrics
- User can split 2 terminals horizontally/vertically
- Resize works smoothly
- Layout persists on refresh
- No performance degradation
- Positive user feedback