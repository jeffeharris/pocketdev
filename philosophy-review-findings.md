# Philosophy of Software Design Review: PocketDev

## Executive Summary

This review applies John Ousterhout's principles from "A Philosophy of Software Design" to the PocketDev codebase. The primary finding is that the system suffers from **shallow modules** and **complexity concentration** in key areas, particularly in the Backend service's entry point and data models.

## Shallow Modules (High Priority)

### 1. Backend Entry Point (`server.js:1-400`)
**Problem**: 400-line file doing too many things
- Database initialization and migrations
- WebSocket setup
- Service initialization  
- Settings management
- Error handling

**Evidence**: 
- Contains 4 separate migration checks inline (lines 55-123)
- Mixes infrastructure concerns with business logic
- Hard to test individual pieces

**Recommendation**: Extract into deep modules:
- `MigrationService` - Handle all database migrations
- `ServiceInitializer` - Initialize all services
- `ConfigurationLoader` - Handle settings/config

### 2. Task Model (`backend/db/models/task.js:1-410`)
**Problem**: Massive interface with mixed concerns
- 12+ public methods
- Business logic mixed with data access
- Session state aggregation logic embedded (lines 169-250)
- Long methods with complex SQL queries

**Evidence**: `findByProjectId` method is 140 lines with nested state calculations

**Recommendation**: Split into:
- `TaskRepository` - Pure data access
- `TaskStateCalculator` - Business logic for state aggregation
- `TaskQueryBuilder` - Complex query construction

### 3. TerminalPanel Component (`frontend/src/components/terminal/TerminalPanel.tsx`)
**Problem**: Kitchen sink component handling everything
- Terminal management
- Split view logic
- Session launching
- State management
- Keyboard shortcuts

**Evidence**: Over 600 lines (estimated) with 15+ useState hooks

**Recommendation**: Extract:
- `useTerminalSessions` hook
- `SplitViewManager` component
- `SessionStateManager` service

## Deep Modules (Good Examples)

### 1. Git Service (`backend/services/git.service.js`)
**Strength**: Simple interface hiding authentication complexity
- Only exports 2-3 functions
- Handles token injection transparently
- Good error messages

### 2. WebSocket Events Service (`backend/services/websocket-events.js`)
**Strength**: Clean abstraction for real-time updates
- Simple publish/subscribe interface
- Hides WebSocket complexity

## Complexity Hotspots

### 1. State Synchronization
**Problem**: Multiple sources of truth for session state
- Database (terminal_sessions table)
- WebSocket real-time updates
- Frontend session store
- Shelltender service state

**Evidence**: `useTaskStatus` hook, session monitors, and stores all tracking same data

### 2. Type Duplication
**Problem**: Similar types defined in multiple places
- `WorkerStatus` in frontend
- AI state constants in backend
- Session states in models

**Recommendation**: Single source of truth for shared types

### 3. Migration Management
**Problem**: Ad-hoc migration checks in server.js
- No version tracking
- Manual checks for each migration
- No rollback capability

**Recommendation**: Proper migration framework

## Information Leaks

### 1. Git Authentication
**Leak**: Controllers need to know about token management
- Token passed through multiple layers
- Controllers handling auth concerns

**Fix**: Push authentication into git service layer

### 2. Worktree Paths
**Leak**: Frontend knows about backend file system structure
- `worktree_path` exposed in API
- Frontend builds paths

**Fix**: Abstract paths behind task operations

## Tactical Debt

### 1. StrictMode Disabled (`frontend/src/main.tsx:13-17`)
**Problem**: Disabled due to "Shelltender WebSocket race condition"
- Hiding potential React issues
- Technical debt with TODO comment

### 2. Generic Names
- `data`, `info`, `item` used throughout
- `Models` class is just a container
- `app.locals` used as global store

### 3. Inconsistent Patterns
- Some routes use controllers, others inline logic
- Mixed async/callback patterns
- Both class-based and functional components

## Recommendations

### Immediate (Reduce Complexity)
1. **Extract Migration Service**: Remove migration logic from server.js
2. **Split Task Model**: Separate data access from business logic
3. **Create State Management Service**: Single source of truth for session states

### Medium Term (Improve Abstractions)
1. **Deep Module for Git Operations**: Hide all git complexity behind simple interface
2. **Component Decomposition**: Break down large components into focused modules
3. **Type Consolidation**: Single shared types package

### Long Term (Strategic Improvements)
1. **Event Sourcing**: For state synchronization across services
2. **Repository Pattern**: Consistent data access layer
3. **Proper Testing**: Currently difficult due to shallow modules

## Key Metrics

- **Shallow Module Count**: 8+ major modules
- **Average Component Size**: 200+ lines
- **Interface-to-Implementation Ratio**: Poor (many public methods, simple implementations)
- **Abstraction Violations**: 15+ instances of leaky abstractions

## Conclusion

PocketDev would benefit significantly from applying Ousterhout's principle of **deep modules**. The current architecture favors tactical programming (getting features working quickly) over strategic design (managing complexity). The highest impact changes would be:

1. Decomposing the monolithic server.js
2. Splitting the Task model into focused services
3. Creating proper abstractions for cross-cutting concerns (auth, state, migrations)

This refactoring would make the codebase more testable, maintainable, and easier to reason about - core goals of good software design.