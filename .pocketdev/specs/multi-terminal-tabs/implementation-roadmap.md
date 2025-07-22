# Multi-Terminal Tabs Implementation Roadmap

## Introduction

Multiple terminal tabs within a task will allow developers to run concurrent AI sessions for different purposes (implementation, testing, planning, merge resolution) without switching between tasks. This feature leverages Shelltender's existing multi-session capabilities to provide a more efficient development workflow.

## Requirements Summary

1. **Tab Management**: Up to 6 persistent tabs per task with rename, reorder, and close functionality
2. **Session Creation**: Quick add (one-click Claude) and advanced launcher (AI agent selection, working directory, initial prompt)
3. **Status Aggregation**: Priority-based task status showing highest priority state across all sessions
4. **Shell Configuration**: Proper bash initialization and Claude auto-launch capabilities
5. **State Persistence**: Tab configuration persists across page reloads

## Implementation Phases

### Phase 1: Backend Multi-Session Support

**Goal**: Enable backend to handle multiple active terminal sessions per task

1. Database schema updates
   - Add columns: tab_name, tab_order, ai_session_id, ai_agent
   - Remove is_active unique constraint
   - Migration script for existing data

2. API endpoints
   - POST /api/tasks/:taskId/terminals - Create session with options
   - PATCH /api/terminals/:sessionId/tab - Update tab properties
   - DELETE /api/terminals/:sessionId - Close terminal session
   - Update GET /api/tasks/:taskId to include all terminals

3. Session management
   - Update terminal.controller.js for multi-session support
   - Modify AI state tracker for per-session states
   - Enhance WebSocket events to include sessionId

**Checkpoint 1 Test Plan**:
- Create multiple terminal sessions for a single task via API
  ```bash
  curl -X POST localhost:3005/api/tasks/123/terminals -d '{"tabName":"Test 1"}'
  curl -X POST localhost:3005/api/tasks/123/terminals -d '{"tabName":"Test 2"}'
  ```
- Verify each session gets unique IDs in database
- Monitor WebSocket events for session-specific identifiers
- Test AI state updates work per-session, not globally
- Confirm backward compatibility with existing single sessions

### Phase 2: Basic Tab UI

**Goal**: Implement visual tab system with basic functionality

1. TerminalTabs component
   - Tab rendering with state indicators
   - Tab switching logic
   - Visual feedback for active/inactive tabs
   - Plus button for new tabs

2. Terminal instance management
   - Refactor TerminalPanel for multiple DirectTerminal instances
   - Handle focus switching between terminals
   - Update refs management

3. State persistence
   - Store tabs in TaskWorkspace state
   - Connect to backend API
   - Restore tabs on component mount

**Checkpoint 2 Test Plan**:
- Visual verification of multiple tabs in UI
- Click tabs to switch between terminal instances
- Verify each terminal maintains independent state/output
- Refresh page and confirm tabs persist
- Test plus button creates new tabs (up to 6)
- Verify focus management when switching tabs
- Check terminal output isolation between tabs

### Phase 3: Quick Claude Launch

**Goal**: One-click Claude session creation

1. Quick add implementation
   - Plus button creates new session
   - Auto-generate tab names
   - Detect terminal ready state

2. Auto-launch Claude
   - Send 'claude' command after terminal ready
   - Handle timing and initialization
   - Show loading state during launch

**Checkpoint 3 Test Plan**:
- Click plus button → verify new tab appears → Claude starts automatically
- Monitor terminal to see 'claude' command executes after prompt
- Verify AI state indicator: gray → blue when Claude ready
- Test error handling (simulate Claude startup failure)
- Confirm tab gets auto-generated name (Tab 1, Tab 2, etc.)
- Measure time from click to Claude ready state
- Test rapid clicking (multiple quick sessions)

### Phase 4: Advanced Session Launcher

**Goal**: Configurable session creation

1. SessionLauncher modal
   - AI agent dropdown (Claude, Aider, etc.)
   - Working directory selection
   - Initial prompt input
   - Tab name customization

2. Command execution
   - Format commands for different AI agents
   - Handle initial prompts properly
   - Store configuration for future reference

**Checkpoint 4 Test Plan**:
- Right-click plus button → verify modal opens
- Test each AI agent option (Claude, Aider, etc.)
- Create session with custom working directory:
  ```bash
  # Verify pwd changes to specified directory
  cd tests/ && aider
  ```
- Test initial prompts with special characters:
  ```
  claude "You are a test engineer focusing on edge cases"
  claude "Handle multi-line\nprompts correctly"
  ```
- Verify template selections (Testing, Planning, Merge)
- Confirm session IDs stored in database
- Test modal validation and error states

### Phase 5: Status Aggregation

**Goal**: Intelligent task status display

1. Aggregation logic
   - Priority: waiting > working > idle > not-started
   - Update TaskStatus component
   - Real-time WebSocket updates

2. UI integration
   - Show aggregate status in task list
   - Tooltip with session details
   - Click to focus tab needing attention

**Checkpoint 5 Test Plan**:
- Create multiple sessions in different states:
  - Session 1: idle (blue)
  - Session 2: working (yellow)
  - Session 3: waiting (purple)
- Verify task shows purple (highest priority)
- Test priority cascade:
  - All idle → task shows blue
  - Add working → task shows yellow
  - Add waiting → task shows purple
- Hover task status → verify tooltip lists all sessions
- Click purple status → verify focus goes to waiting tab
- Test real-time updates via WebSocket
- Verify status updates when sessions change state

### Phase 6: Tab Management Features

**Goal**: Quality-of-life improvements

1. Tab operations
   - Double-click to rename
   - Drag to reorder
   - Close with confirmation
   - Keyboard shortcuts (Ctrl+1-6)

2. Resource management
   - Enforce 6 tab limit
   - Clean up on close
   - Memory optimization

**Checkpoint 6 Test Plan**:
- Double-click tab → verify inline edit mode
- Type new name → press Enter → verify persists
- Drag tab to reorder → verify new order saves
- Test keyboard shortcuts:
  - Ctrl+1 through Ctrl+6 to switch tabs
  - Ctrl+T for new tab
  - Ctrl+W to close current tab
- Try to exceed 6 tabs → verify plus button disables
- Close tab with active AI → verify confirmation dialog
- Test edge cases:
  - Close last tab → verify prevented
  - Rename during AI processing
  - Reorder during state changes
- Verify all changes persist after page refresh

## Technical Considerations

1. **Performance**: Lazy load terminals, virtualize inactive tabs
2. **Focus Management**: Proper xterm.js instance handling
3. **State Sync**: Handle WebSocket updates efficiently
4. **Security**: Maintain existing Shelltender restrictions

## Implementation Decisions

1. **UI Design**: Keep our navbar style, not Shelltender's tabs
2. **Session IDs**: Track both Shelltender and AI session IDs
3. **Auto-launch**: Use WebSocket to send commands after terminal ready
4. **Persistence**: Store tab config in database, restore on load

## Tasks

### Phase 1: Backend Infrastructure ✅ COMPLETE
- [x] 1.1 Create database migration
- [x] 1.2 Implement new API endpoints
- [x] 1.3 Update session management logic

**Completed**: 2025-07-21
- Database migration applied successfully
- POST /api/tasks/:taskId/terminals endpoint working
- PATCH /api/terminals/:sessionId/tab endpoint working
- Session model updated with multi-tab support
- All tests passing (see phase1-test-results.md)

### Phase 2: Tab UI Foundation ✅ COMPLETE
- [x] 2.1 Create TerminalTabs component
- [x] 2.2 Refactor TerminalPanel for multiple terminals
- [x] 2.3 Implement tab state persistence

**Completed**: 2025-07-21
- TerminalTabs component with state indicators
- TerminalPanel refactored for multiple DirectTerminal instances
- Tab switching and focus management working
- Persistence via task.terminals array
- Plus button creates new tabs (max 6)
- See phase2-test-plan.md for verification

### Phase 3: Quick Launch ✅ COMPLETE
- [x] 3.1 Implement plus button handler
- [x] 3.2 Add auto-launch logic
- [x] 3.3 Handle initialization timing

**Completed**: 2025-07-21
- DirectTerminal monitors output for bash prompt
- Automatic Claude launch on new tab creation
- Loading state (yellow) during launch
- WebSocket command sending implemented
- See phase3-test-plan.md for verification

### Phase 4: Advanced Launcher
- [ ] 4.1 Create SessionLauncher modal
- [ ] 4.2 Implement AI agent support
- [ ] 4.3 Add initial prompt execution

### Phase 5: Status System
- [ ] 5.1 Implement aggregation logic
- [ ] 5.2 Update TaskStatus component
- [ ] 5.3 Add focus navigation

### Phase 6: Polish
- [ ] 6.1 Add rename functionality
- [ ] 6.2 Implement drag-to-reorder
- [ ] 6.3 Add keyboard shortcuts