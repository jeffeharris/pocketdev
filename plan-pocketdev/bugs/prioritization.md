# Bug Prioritization & Status

## Overview
This document tracks the prioritization and status of all filed bugs in the PocketDev project. A clear pattern has emerged: **massive files with mixed responsibilities** throughout the codebase, indicating a systemic architectural issue.

## Prioritization Table

| Bug ID | Title | Type | Lines | Priority | Impact | Status | Target Date |
|--------|-------|------|-------|----------|---------|---------|-------------|
| BUG-003 | Terminal sessions not loading on task open | Functional | N/A | **Critical** | Blocks core functionality | Open | 2025-08-05 |
| BUG-001 | AI state monitoring stuck state | Functional | N/A | **High** | Poor UX, unreliable state | Open | 2025-08-08 |
| BUG-002 | AI state timeout implementation | Functional | N/A | **High** | System resources, UX | Open | 2025-08-10 |
| BUG-010 | task.controller.js needs modularization | Technical Debt | 965 | **High** | Core API maintainability | Open | 2025-08-15 |
| BUG-007 | git.service.js needs modularization | Technical Debt | 985 | **High** | All git operations affected | Open | 2025-08-20 |
| BUG-011 | api.ts needs domain splitting | Technical Debt | 848 | **High** | API layer affects all features | Open | 2025-08-22 |
| BUG-009 | Sidebar component needs decomposition | Technical Debt | 903 | **High** | Primary UI, performance | Open | 2025-08-25 |
| BUG-005 | DiffViewerModal needs decomposition | Technical Debt | 1,207 | **Medium** | Complex but isolated | Open | 2025-08-30 |
| BUG-006 | Simplify PrototypeMergeConflict | Technical Debt | 1,041 | **Medium** | Blocks production integration | Open | 2025-09-05 |
| BUG-004 | project.controller.js needs modularization | Technical Debt | 1,117 | **Medium** | Less frequently modified | Open | 2025-09-10 |
| BUG-008 | Refactor MergeWorkflowPrototype | Technical Debt | 1,173 | **Low** | Prototype cleanup | Open | 2025-09-15 |

## Priority Rationale

### Critical (Fix Immediately)
- **BUG-003**: Users cannot open terminals = cannot work. This is a showstopper.

### High (Fix Soon)
- **BUG-001 & BUG-002**: AI state issues cause frustration and wasted resources
- **BUG-010**: task.controller.js is touched by every task operation (965 lines)
- **BUG-007**: git.service.js affects every git operation in the system (985 lines)
- **BUG-011**: api.ts is the frontend's gateway to all backend operations (848 lines)
- **BUG-009**: Sidebar is the main UI component users interact with constantly (903 lines)

### Medium (Plan to Fix)
- **BUG-005**: DiffViewerModal is huge (1,207 lines) but contained to one feature
- **BUG-006**: PrototypeMergeConflict needs simplification before production use
- **BUG-004**: project.controller.js is large (1,117 lines) but more stable/less modified

### Low (Nice to Have)
- **BUG-008**: MergeWorkflowPrototype is just prototype cleanup, not production code

## Overarching Patterns Identified

### 1. **Systemic File Bloat**
- 8 files over 848 lines (avg: 1,034 lines)
- Total lines needing refactoring: **8,319 lines**
- Files grow unchecked until they become unmaintainable

### 2. **Mixed Responsibilities Anti-Pattern**
Every large file exhibits the same problems:
- Controllers performing service-level work
- Components handling business logic AND UI
- Services mixing multiple unrelated domains
- Prototypes evolving into production-sized components

### 3. **Missing Architectural Boundaries**
- No consistent service layer between controllers and models
- Controllers directly executing git commands
- Components making direct API calls
- Unclear separation between UI logic and business logic

### 4. **Technical Debt Metrics**
- **37 React hooks** in a single component (BUG-005)
- **188-line if/else chain** in render method (BUG-009)
- **153-line method** in controller (BUG-010)
- **Mixed paradigms** - both functions and classes for same operations (BUG-007)
- **44 methods** in single API service class (BUG-011)
- **Inline mocking** throughout production code (BUG-011)

## Root Cause Analysis

The codebase lacks:
1. **File size limits** - No linting rules to prevent growth
2. **Clear architecture guidelines** - Developers unsure where code belongs
3. **Code review standards** - Large files get merged without splitting
4. **Refactoring culture** - Features added without cleanup

## Recommended Action Plan

### Week 1 (Aug 1-7): Emergency Fixes
1. Fix BUG-003 (terminal sessions) - critical functionality
2. Establish coding standards to prevent new bloat
3. Add ESLint rule: warn on files > 400 lines

### Week 2 (Aug 8-14): Core Stability
1. Fix BUG-001 & BUG-002 (AI state issues)
2. Begin BUG-010 (task.controller.js) - highest impact backend file

### Week 3-4 (Aug 15-28): Architecture Refactoring
1. Complete BUG-010 and establish controller patterns
2. Tackle BUG-007 (git.service.js) - core service layer
3. Refactor BUG-011 (api.ts) - critical frontend infrastructure
4. Start BUG-009 (Sidebar) - improve UI performance

### Month 2 (September): Systematic Cleanup
1. Apply established patterns to remaining files
2. Focus on production-blocking issues (BUG-006)
3. Clean up technical debt systematically

## Success Metrics
- **File size**: No production file over 400 lines (currently 8 over 848)
- **Method size**: No method over 50 lines (currently multiple over 100)
- **Test coverage**: Increase by 30% (smaller files easier to test)
- **Performance**: 25% reduction in UI re-renders
- **Developer velocity**: 40% faster feature development

## Review Schedule
- **Daily**: Check progress on critical bugs
- **Weekly**: Review bug status and adjust priorities
- **Bi-weekly**: Assess architectural improvements
- **Monthly**: Measure success metrics

## Notes
- All bugs reported on 2025-08-01 during "Marie Kondo" code review
- Prototypes (BUG-006, BUG-008) serve different purposes but both suffer from scope creep
- BUG-005 reports 37 React hooks in one component - a clear code smell
- Several controllers already have partial separation (task-git.controller.js exists)
- BUG-011 reveals frontend API layer mirrors backend's god object pattern

---

*Created: 2025-08-01*  
*Last Updated: 2025-08-01*  
*Next Review: 2025-08-08*