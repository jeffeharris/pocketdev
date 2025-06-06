# Changelog

All notable changes to the PocketDev project will be documented in this file.

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