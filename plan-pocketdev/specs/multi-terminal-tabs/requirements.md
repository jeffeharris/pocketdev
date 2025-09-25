# Multi-Terminal Tabs Requirements

<!-- Document Metadata
Created: 2025-07-28
Modified: 2025-07-28
Status: ????
-->


## Introduction

The Multi-Terminal Tabs feature enhances PocketDev by allowing developers to run multiple concurrent AI sessions within a single task. This eliminates the need to switch between tasks for different development activities (implementation, testing, planning, merge resolution) and enables more efficient AI-assisted development workflows.

## Requirements

### Requirement 1: Tab Management

**User Story:** As a developer, I want to manage multiple terminal sessions within a task through a tabbed interface, so that I can run concurrent AI sessions without switching tasks.

#### Acceptance Criteria

1. WHEN a user opens a task THEN the system SHALL display a tab bar with at least one active terminal session
2. WHEN displaying a tab THEN the system SHALL show a colored activity indicator matching the session's AI state:
   - Gray (not-started): No AI session active
   - Blue (idle): AI session active, waiting for input  
   - Yellow (working): AI is processing/thinking
   - Purple (waiting): AI needs user response/confirmation
3. WHEN a user clicks the plus button THEN the system SHALL create a new terminal session and add a new tab (up to a maximum of 6 tabs per task)
4. WHEN a user closes a tab THEN the system SHALL terminate the associated terminal session and remove the tab from the UI
5. IF only one tab remains THEN the system SHALL disable the close button on that tab
6. WHEN a user refreshes the page THEN the system SHALL restore all previously open tabs with their terminal sessions
7. WHEN a user double-clicks a tab name THEN the system SHALL enable inline editing of the tab name
8. IF a user drags a tab THEN the system SHALL reorder tabs and persist the new order
9. WHEN rendering tabs THEN the system SHALL dynamically size tabs based on available space and content
10. IF all tabs fit comfortably THEN the system SHALL size each tab to fit its content with appropriate padding
11. WHEN space is constrained THEN the system SHALL distribute available space equally among all tabs
12. IF tab text exceeds its allocated width THEN the system SHALL truncate with ellipsis and show full name on hover
13. WHEN tabs cannot fit even at minimum viable width THEN the system SHALL enable horizontal scrolling with arrow buttons

### Requirement 2: Quick Claude Launch

**User Story:** As a developer, I want to quickly start a new Claude session with one click, so that I can immediately begin coding without manual setup.

#### Acceptance Criteria

1. WHEN a user clicks the plus button THEN the system SHALL create a new terminal session and automatically execute the 'claude' command
2. WHEN the terminal is ready THEN the system SHALL wait for the shell prompt before sending the claude command
3. IF Claude fails to start THEN the system SHALL leave the terminal at the bash prompt for manual intervention
4. WHEN creating a quick session THEN the system SHALL name the tab incrementally (e.g., "Tab 1", "Tab 2")
5. WHEN Claude starts successfully THEN the system SHALL update the tab's visual indicator to show AI is ready (blue state)

### Requirement 3: Advanced Session Launcher

**User Story:** As a developer, I want to configure AI sessions with specific agents and prompts, so that I can tailor each session to its intended purpose.

#### Acceptance Criteria

1. WHEN a user right-clicks the plus button or uses a keyboard shortcut THEN the system SHALL display the SessionLauncher modal
2. WHEN the modal opens THEN the system SHALL show options for: AI agent selection, working directory, initial prompt, and tab name
3. WHEN a user selects an AI agent THEN the system SHALL show Claude (default), Aider, Codex, and Gemini as options
4. IF a user provides an initial prompt THEN the system SHALL execute the AI command with the prompt properly escaped and quoted
5. WHEN a user specifies a working directory THEN the system SHALL change to that directory before launching the AI
6. IF the session starts successfully THEN the system SHALL store both the Shelltender session ID and AI session ID (when available) in the database

### Requirement 4: Task Status Aggregation

**User Story:** As a developer, I want to see an aggregated status for each task that reflects all active terminal sessions, so that I know which tasks need my attention.

#### Acceptance Criteria

1. WHEN multiple terminal sessions exist for a task THEN the system SHALL display an aggregated status based on priority
2. WHEN calculating aggregate status THEN the system SHALL use this priority order: waiting (needs attention) > working > idle > not-started
3. IF any session is in "waiting" state THEN the task status SHALL show "needs attention" (purple) regardless of other session states
4. WHEN a user hovers over the task status THEN the system SHALL display a tooltip listing all sessions and their individual states
5. IF a user clicks on a task status showing "needs attention" THEN the system SHALL open the task and focus the tab that needs attention

### Requirement 5: Session State Persistence

**User Story:** As a developer, I want my terminal tabs and their configurations to persist, so that I can resume work exactly where I left off.

#### Acceptance Criteria

1. WHEN a terminal session is created THEN the system SHALL store the tab name, order, AI agent type, and session IDs in the database
2. WHEN a user modifies tab properties (name, order) THEN the system SHALL immediately persist these changes
3. IF a user navigates away and returns THEN the system SHALL restore all tabs in their previous order with proper names
4. WHEN restoring sessions THEN the system SHALL reconnect to existing Shelltender sessions without restarting them
5. IF a Shelltender session no longer exists THEN the system SHALL create a new session and indicate it was restored

### Requirement 6: Specialized Session Types

**User Story:** As a developer, I want to launch AI sessions with specific contexts, so that the AI immediately understands its role without additional prompting.

#### Acceptance Criteria

1. WHEN using the advanced launcher THEN the system SHALL offer template options: Planning Preset, Merge Resolution, Testing, and Custom
2. IF "Planning Preset" is selected THEN the system SHALL create three tabs labeled "Requirements", "Design", and "Tasks" with appropriate initial prompts for each:
   - Requirements: "You are a requirements analyst. Help define and refine requirements in EARS format."
   - Design: "You are a system architect. Help design technical solutions and create design documents."
   - Tasks: "You are a project planner. Help break down work into actionable tasks and implementation steps."
3. IF "Merge Resolution" is selected THEN the system SHALL launch Claude with a prompt focused on resolving git conflicts
4. IF "Testing" is selected THEN the system SHALL launch the AI with a prompt focused on writing and improving tests
5. WHEN launching a specialized session THEN the system SHALL name the tab according to its type
6. IF a custom prompt is provided THEN the system SHALL preserve line breaks and special characters when sending to the AI

## Implementation Notes

### Technical Considerations

1. **Terminal Management**: Use existing DirectTerminal component instances, one per tab
2. **Performance**: Implement lazy loading - only create terminal instances when tabs are first activated
3. **WebSocket Updates**: Enhance events to include sessionId for proper routing of state updates
4. **Database**: Remove the is_active unique constraint to allow multiple active sessions per task

### Shell and AI Configuration

1. **Shell Launch**: Continue using `bash --login` to ensure profiles are loaded
2. **Command Timing**: Implement a reliable wait mechanism for shell readiness before sending commands
3. **AI Commands**: 
   - Claude: `claude` or `claude "prompt"`
   - Aider: `aider` with appropriate flags
   - Other agents: Configure based on their CLI interfaces
4. **Session IDs**: Parse AI output to capture session IDs when available for future resume functionality

### UI/UX Guidelines

1. **Tab Design**: Maintain consistency with existing PocketDev navbar styling
2. **State Colors**: Use existing color scheme (gray=not-started, blue=idle, yellow=working, purple=waiting)
3. **Keyboard Shortcuts**: Ctrl+1-6 for tab switching, Ctrl+T for new tab, Ctrl+W for close tab
4. **Loading States**: Show clear feedback during session creation and AI startup