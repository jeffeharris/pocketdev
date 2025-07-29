# Split Views Feature - Implementation Team Handoff

## Feature Overview

Implement split view functionality allowing users to view 2 terminal sessions side-by-side within a single task. Users can toggle between tab view and split view, with horizontal/vertical orientation options.

## Pre-Implementation Reading

1. **Requirements**: `./requirements.md` - Full EARS-format requirements
2. **Technical Design**: `./technical-design.md` - Architecture decisions and rationale
3. **Risk Analysis**: `./risk-analysis-and-viability-test.md` - Identified risks and mitigations
4. **Viability Results**: `./viability-test-results.md` - Performance test results (all passed)

## Implementation Resources

### Branch
- Work on: `feature/split-views`
- Base: `feature/multi-terminal-tabs` (ensure this is merged first)

### Key Decisions Made
- **Layout**: CSS Grid (not flexbox or library)
- **State**: Zustand store (approved for new dependency)
- **Persistence**: JSON in tasks.split_layout column
- **Performance**: Lazy render terminals (only create xterm when visible)
- **Scope**: 2-way splits only for Phase 1

### Implementation Guide
- **Phase 1 Plan**: `./phase1-implementation-plan.md` - 6-day breakdown
- **Checklist**: `./implementation-checklist.md` - Task tracking

## Technical Context

### Current Architecture
- **Multi-terminal tabs**: Already implemented, each task can have multiple terminal sessions
- **Session IDs**: Note there are 3 different IDs (sessionId, dbSessionId, shelltenderSessionId) - tech debt to address later
- **State Management**: Currently using prop drilling - this feature introduces Zustand for terminal state

### Performance Targets
- Maintain 30+ FPS with 2 active terminals
- Memory usage <500MB
- Resize operations at 24+ FPS minimum

### Critical Code Locations
```
frontend/src/components/terminal/TerminalPanel.tsx - Main integration point
frontend/src/components/terminal/TerminalTabs.tsx - Existing tab implementation
backend/controllers/taskController.js - Add split layout endpoints
backend/db/migrations/ - Add 004_split_view_layouts.sql
```

## Implementation Guidelines

### Backend First
1. Start with database migration and API endpoints
2. Test with Postman/curl before frontend work
3. WebSocket handlers can be added after core API works

### Frontend Architecture
```
TerminalPanel
├── TerminalTabs (existing, shown in both modes)
└── SplitViewContainer (new)
    ├── SplitViewControls
    ├── SplitPane (Terminal 1)
    ├── ResizeDivider
    └── SplitPane (Terminal 2)
```

### State Management Pattern
```typescript
// Don't store xterm instances in Zustand
// Only store layout configuration and terminal IDs
// Let React components manage xterm lifecycle
```

### Testing Requirements
- Unit tests for all new components
- Integration test for layout persistence
- Manual testing on Chrome, Firefox, Safari
- Mobile testing (should auto-collapse)

## Common Pitfalls to Avoid

1. **Don't dispose terminals on view switch** - Hide them instead
2. **Don't store xterm instances in global state** - Memory leak risk
3. **Don't forget resize debouncing** - Critical for performance
4. **Don't break existing tab functionality** - Feature flag must work

## Questions to Resolve Before Starting

1. **AI Agent Assignment**: How should split view handle showing different AI agents? Same agent in both terminals or support different agents?
2. **Keyboard Shortcuts**: Confirm Ctrl+Shift+Arrow keys don't conflict with existing shortcuts
3. **Mobile Breakpoint**: Confirm 768px is the right breakpoint for auto-collapse
4. **Max Terminals**: Should we enforce max 2 terminals in split view even if more exist?

## Definition of Done

- [ ] All requirements from `requirements.md` implemented
- [ ] Performance targets maintained
- [ ] Feature flag enables/disables cleanly
- [ ] No regressions in tab mode
- [ ] Tests passing
- [ ] Documentation updated
- [ ] Code reviewed by senior developer

## Support During Implementation

- Architecture questions: Refer to technical design doc
- Performance issues: See viability test setup for profiling
- Integration issues: Check tech debt doc for known gotchas

## Rollback Plan

If critical issues found:
1. Set `REACT_APP_FEATURE_SPLIT_VIEW=false`
2. Migration is safe (nullable column)
3. Git revert if needed

## Success Metrics

Track and report:
- Time to implement vs estimate (6 days)
- Performance metrics achieved
- Any architectural surprises
- User feedback from internal testing

---

**Note**: This is Phase 1 of a multi-phase feature. Keep implementation focused on 2-way splits only. Document any ideas for Phase 2 (4-way splits) but don't implement them.