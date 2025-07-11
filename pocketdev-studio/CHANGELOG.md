# Changelog

All notable changes to the PocketDev project will be documented in this file.

## [Unreleased]

## [0.3.0] - 2025-06-07 - Phase 1: Database Foundation & Task Persistence

### Added
- **SQLite Database Integration**
  - Complete database schema with Drizzle ORM
  - Tables for projects, tasks, engineer profiles, and task events
  - Automatic project creation based on repository URLs
  - Database management scripts (db:push, db:seed, db:verify)

- **Task Persistence System**
  - All tasks now persist across server restarts
  - Complete task lifecycle tracking with metadata
  - Task events for full audit trail
  - Engineer performance metrics (success rate, cost, task counts)

- **Task Review Workflow**
  - Accept/Reject/Request Changes UI in TaskView
  - Task states: queued → in_progress → awaiting_review → accepted/rejected
  - Review actions update database and trigger appropriate workflows
  - Acceptance criteria display with completion checkmarks

- **Enhanced Task Metrics**
  - Token usage display (input/output tokens)
  - Number of turns/iterations tracking
  - Detailed cost and duration metrics
  - Performance data stored per engineer

- **Search & Filter Functionality**
  - Search tasks by description, engineer, or files
  - Filter by status (Complete, Failed, Running)
  - Filter by engineer role (Frontend, Backend, DevOps)
  - Results count showing filtered vs total tasks

### Changed
- Engineers now loaded from database instead of hardcoded
- Task history fetches from database with full state information
- ContainerTaskManager integrated with database operations
- TaskView enhanced with review UI and better metrics display

### Database Schema
- `projects` - Repository and project settings
- `engineer_profiles` - AI engineer configurations and performance metrics
- `tasks` - Complete task details with status, results, and metrics
- `task_events` - Event log for task state transitions

## [0.2.1] - 2025-06-07

### Added
- Automatic verification retry logic for failed test scripts
  - AI engineers get a second chance to fix verification failures
  - Intelligent error analysis provides specific feedback
  - Detects file not found, module errors, and syntax issues
  - Creates verification scripts if missing
- Branch name sanitization logging
  - Logs warnings when branch names need sanitization
  - Shows what was changed (quotes, colons, special chars)
  - Displays original vs sanitized versions
- Dedicated task view page with routing
  - Comprehensive task details display
  - Auto-refresh every 5 seconds for running tasks
  - Shows files created, test results, and suggested next steps
  - Toggle between task results and logs

### Changed
- Updated to latest Claude 4 model family
  - Claude Opus 4 (Most Capable)
  - Claude Sonnet 4 (Balanced)
  - Claude 3.7 Sonnet (Extended Thinking)
  - Previous models still available as fallbacks
- Improved branch name sanitization
  - Removes quotes (single, double, backticks)
  - Replaces colons with hyphens
  - Limits to 50 characters
  - Validates final branch name before creation

### Fixed
- Bash syntax error with quote regex in entrypoint.sh
- Python vs python3 compatibility in verification scripts
- Verbose mode breaking JSON output from Claude CLI
- Prompt delivery using stdin instead of arguments
- Multi-line prompt and system prompt handling
- Branch names with special characters breaking git checkout

### Technical Details
- Verification retry uses `run_claude()` with session continuation
- Branch sanitization uses comprehensive sed/tr pipeline
- Task view integrated with React Router for SPA navigation
- Model updates reflect Anthropic's latest API identifiers

## [0.2.0] - 2025-01-06

### Added
- Complete containerized AI developer system with Docker isolation
- Real-time log streaming from containers (2-second polling intervals)
- Task result visualization with success/failure, files changed, cost, and duration
- Accept & Commit workflow for reviewing and pushing changes to GitHub
- Request Changes functionality for iterative development
- Automatic feature branch creation and GitHub PR generation
- Multiple engineer roles: Frontend, Backend, and DevOps specialists
- One-shot task execution approach (moved away from rigid TDD)
- Simple verification scripts without framework dependencies
- JSON result files for inter-process communication
- Signal-based container lifecycle management (SHUTDOWN/CONTINUE)
- Workspace persistence across task sessions
- Automatic Git authentication with personal access tokens
- Enhanced UI components:
  - `TaskResultView` for rich result display
  - `ContainerEngineerCardEnhanced` with polling support
  - Real-time status updates with visual indicators

### Changed
- Simplified from rigid TDD approach to flexible one-shot implementation
- Moved from waiting for container exit to polling for results
- Enhanced error handling with proper JSON escaping for task descriptions
- Improved UI with rich task result displays
- Updated Docker configuration to use Node.js 18 for Claude compatibility
- Refactored entrypoint.sh for simpler, more reliable execution flow
- Updated container orchestration to support async result checking

### Fixed
- Environment variable passing between host → backend → AI containers
- PostCSS ES module compatibility issues
- Docker compose version warnings
- JSON escaping bug for task descriptions containing quotes (`jq -Rs` escaping)
- Container detection of task completion (polling vs waiting)
- Git push authentication with proper token usage
- Claude CLI installation in Docker (Node.js 18 requirement)

### Technical Details
- Implemented polling-based result checking instead of blocking waits
- Added `checkTaskResults()` method to ContainerOrchestrator
- Created `TaskResultView` component for rich result display
- Enhanced `ContainerEngineerCard` with automatic polling
- Implemented `acceptTask()` and `continueTask()` in ContainerTaskManager
- Added signal file monitoring in entrypoint.sh
- Result JSON structure includes: success, sessionId, summary, error, duration, cost, files changed, test results, and PR URL

## [0.1.0] - 2024-01-06 - Initial Containerized System

### Added

#### Documentation
- Comprehensive containerization architecture plan
- Claude SDK integration documentation with session management
- Usage guide for containerized AI developers
- Integration guide with examples and troubleshooting
- Project overview in README

#### Docker Infrastructure
- Dockerfile with Claude CLI, Git, and development tools
- Comprehensive entrypoint.sh script for TDD workflow
- Git integration with branch management
- Session persistence across container runs
- Build script for easy Docker image creation

#### Backend Container System
- ContainerOrchestrator class for Docker container management
- ContainerTaskManager for high-level task coordination
- Session persistence and continuation support
- Comprehensive REST API endpoints:
  - `/api/container/engineers` - List container engineers
  - `/api/container/assign-task` - Assign repository-based tasks
  - `/api/container/continue-task` - Continue existing sessions
  - `/api/container/tasks/:id` - Get task details
  - `/api/container/engineers/:id/history` - Task history
  - `/api/container/build-image` - Build Docker image
- Unit tests for orchestration components
- Support for Frontend, Backend, and DevOps engineer roles

#### Frontend Updates
- ContainerEngineerCard component with Docker-specific UI
- ContainerTaskModal for repository-based task assignment
- View mode toggle for filtering engineer types (Host/Container/All)
- Git authentication support in task modal
- Real-time status updates for container tasks

#### Claude Integration
- HostClaudeManager for local Claude CLI execution
- DockerClaudeManager for containerized execution
- CodeExtractor to parse and save generated code
- Support for multiple Claude models (Sonnet, Opus, Claude 3.5)
- Session management using `--resume` and `--continue` flags

### Features

1. **Isolated Execution**: Each task runs in its own Docker container
2. **Test-Driven Development**: AI writes tests first, then implementation
3. **Git Workflow**: Automatic branch creation, commits, and PR links
4. **Session Continuity**: Claude conversations persist across task steps
5. **Role Specialization**: Custom system prompts for different engineer types
6. **Cost Tracking**: Monitor API usage and costs per task
7. **Error Recovery**: Reset engineers, stop tasks, cleanup workspaces

### Technical Stack

- **Backend**: Node.js, Express, Docker SDK
- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **AI**: Claude CLI with session management
- **Infrastructure**: Docker containers with isolated workspaces
- **Testing**: Jest with ES modules support

## [0.0.1] - Initial Concept

### Added
- Initial project structure and planning documents
- Basic web interface mockup
- Architecture design for mobile-first AI team management
- Integration research for multi-agent frameworks