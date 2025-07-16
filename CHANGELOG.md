# Changelog

All notable changes to the PocketDev Simple Server will be documented in this file.

## [Unreleased]

### Added
- **GitHub Token Middleware**
  - Implemented centralized middleware for GitHub token injection
  - Reduced database queries from 65+ per request to just 1
  - All routes now use consistent `req.githubToken` pattern
  - Improved performance and maintainability
- **GitHub CLI Integration**
  - Added gh CLI v2.40.1 to backend container
  - Switched from temporary remotes to gh credential helper
  - Git operations now use `GH_TOKEN` environment variable
  - Proper authentication for fetch, pull, and push operations
- **Shelltender v0.6.1 Upgrade**
  - Upgraded @shelltender/server from v0.5.0 to v0.6.1
  - Fixed WebSocket 404 issues with deferred setup
  - Added support for all convenience API methods (createSession, getSession, etc.)
  - Improved session environment handling to include AI tools
  - Sessions now use login shell to properly load PATH
  - Implemented workaround for admin UI - downloads from GitHub on first access
  - Admin UI now available at http://localhost:8080/admin with bulk session management
- **Branch Autocomplete in Task Creation**
  - Added reusable BranchSelector component with search and filtering
  - Implemented keyboard navigation (arrow keys, enter, escape)
  - Shows branch status labels (Protected, In use, Base branch)
  - Prevents selection of occupied or protected branches
  - Includes both local and remote branches in suggestions
- **Git Diff Viewer Backend Infrastructure (Phase 1)**
  - Added getAllChanges endpoint to get combined view of working tree and committed changes
  - Implemented individual file staging/unstaging operations via gitOperation endpoint
  - Enhanced git service with methods for unpushed commit detection
  - Added proper file categorization (staged, unstaged, untracked, committed)
  - Improved line count accuracy for all file types including untracked files
- **Git Diff Viewer UI Enhancement (Phase 4)**
  - Integrated three-state toggle (Working Tree/All Changes/Branch Diff) into DiffViewerModal
  - Added StatusIcon component showing git status with appropriate icons for each file
  - Implemented single data loading approach with client-side filtering for better performance
  - Fixed caching to properly work across different comparison modes
  - Enhanced backend to support 'all' mode showing complete diff from base to working tree
  - Added staged/unstaged filter for Working Tree and All Changes views
  - Fixed status code handling to support both working tree (2-letter) and committed (1-letter) formats
  - Improved empty states with contextual messages for each view mode

### Fixed
- **Git Authentication Errors**
  - Fixed "could not read Username" errors during git fetch operations
  - Corrected PLANNING.md path to use .pocketdev/PLANNING.md consistently
  - Fixed git service authentication for fetch/pull/push commands
  - Resolved issue where refresh button triggered different checks than initial load
- **Planning Editor Modal**
  - Fixed content not showing when modal opens
  - Added useEffect to sync content when modal state changes
  - Planning container on dashboard now has fixed height with scrollable content
  - Added minimal scrollbar styling for better UX
- **Git Status API Refactoring**
  - Fixed all frontend API methods to include projectId parameter for proper scoping
  - Updated backend to use getComprehensiveDiff for accurate line counts
  - Changed git status to use --untracked-files=all for individual file listing
  - Resolved 0/0 line count display issues in diff viewer
- **Branch Loading in Task Creation**
  - Fixed API response parsing for branch endpoint
  - Changed from Promise.all to Promise.allSettled to handle partial API failures
  - Task creation modal now properly loads branches even when planning API fails
- **Container Segmentation Fault**
  - Switched Shelltender from Alpine to Ubuntu-based image (pocketdev/ai-base)
  - Fixed node-pty compatibility issues causing exit code 139
  - Removed node-fetch import (using built-in fetch in Node.js 22)
- **GitHub API Key Saving Error**
  - Fixed encryption key validation causing 500 errors when saving settings
  - Added proper hex string to buffer conversion for encryption keys
  - Improved error messages with clear instructions for key generation
  - Backend now properly validates 32-byte encryption key requirement
- **Terminal Cursor Display Issues**
  - Fixed duplicate cursor display in terminal
  - Set cursor to non-blinking block style for better visibility
  - Added CSS rules to hide xterm's native cursor element
  
### Changed
- **Docker Architecture Reorganization**
  - Moved service-specific Dockerfiles to their respective directories:
    - `backend/Dockerfile` (previously Dockerfile.backend-new)
    - `frontend/Dockerfile` (new production build)
    - `shelltender/Dockerfile` (previously Dockerfile.shelltender-new)
  - Updated docker-compose.yml to use new Dockerfile paths
  - Added .dockerignore files to each service directory
  - Updated Makefile container references (pocketdev-project-manager → backend)
  - Preserved secure Dockerfiles for future production use

### Documentation
- Updated CLAUDE.md with comprehensive development guidance:
  - Added common development commands
  - Documented three-service architecture
  - Added key technical patterns (git worktrees, AI state tracking)
  - Included database schema relationships
  - Added WebSocket events documentation
  - Emphasized critical frontend import rules for Vite

### Added
- Upgraded @shelltender/client from v0.4.0 to v0.4.3 for terminal focus/fit API support
- Implemented automatic terminal focus when:
  - Page loads initially
  - Switching between tasks
  - Returning from another browser tab
  - Window regains focus
  - Closing modals (Create Task modal)
- Added DOM-based fallback for terminal focus due to v0.4.3 bundler issue
- Added comprehensive documentation for Shelltender upgrade process
- Added WebSocketProvider configuration for proper WebSocket URL handling

### Changed
- Updated DirectTerminal component to use new TerminalHandle ref API
- Improved terminal auto-focus behavior with multiple trigger points
- Enhanced TaskWorkspace with focusActiveTerminal helper function
- Terminal now uses `/shelltender-ws` proxy path consistently

### Fixed
- Terminal focus now works immediately when switching tasks (using DOM fallback)
- Terminal properly resizes when window size changes
- Fixed TypeScript import for TerminalHandle type (must use `import type`)

### Known Issues
- @shelltender/client v0.4.3 has a bug where forwardRef is stripped by Vite's bundler
  - Using DOM fallback (.xterm-helper-textarea) until v0.4.4 is released
  - Shelltender team has confirmed fix using Object.assign() pattern

### Documentation
- Added detailed Shelltender upgrade guides in `simple/docs/shelltender/`
- Documented investigation of v0.4.3 ref forwarding issue
- Added implementation notes for future Shelltender upgrades

### Fixed
- **Critical Git Stashing Issues**
    - Removed dangerous nested stashing from git conflict checking operations
    - Replaced stash-based conflict detection with `git merge-tree --write-tree` (non-destructive)
    - Fixed race conditions caused by background git status monitoring creating stashes every 30 seconds
    - Added proper stdout handling for git commands that exit with non-zero codes
    - Implemented temporary worktree approach for detailed conflict analysis when needed
    - Prevents corruption of git worktrees from concurrent stashing operations

### Added
- **Mobile-Responsive UI**
    - Complete responsive design for projects.html and project-page.html
    - Collapsible sidebar with hamburger menu for mobile navigation
    - Touch-friendly controls with minimum 44px touch targets
    - Mobile-optimized modals and forms
    - Responsive breakpoints at 768px and 480px

- **Enhanced Terminal Fullscreen**
    - Native Fullscreen API support for compatible browsers
    - WebKit fullscreen support for Safari/iOS
    - iOS-specific tips for adding to home screen
    - Proper fullscreen event handling and UI synchronization
    - Meta tags for web app capability on mobile devices

- **Terminal Integration with @shelltender/client**
    - Replaced iframe-based terminal with native @shelltender/client Terminal component
    - Direct WebSocket connection through Vite proxy
    - Improved focus management with React refs
    - Session persistence with task-specific session IDs
    - Fixed port configuration (WebSocket on 8081, API on 8080)

- **File Upload System**
    - Support for images, documents, code files, config files, and archives
    - Drag & drop, clipboard paste, and file browser upload methods
    - File size limit: 10MB per file
    - Storage limit: 100MB per task, max 50 files
    - Files stored in `.pocketdev/attachments/` within task worktree
    - Reference path copying for easy use in AI conversations
    - Compact horizontal layout for narrow sidebar
    - Visual feedback for copy actions and hover states
    - Icon-based file type indicators

### Changed
- Button and control sizing now relative and touch-optimized
- Project cards stack vertically on mobile devices
- Terminal container height adjusted for mobile viewing
- Form inputs prevent zoom on iOS with 16px font size
- Upload system now supports multiple file types beyond images
- Terminal focus automatically set when switching tasks

### Fixed
- Terminal resize issues (awaiting @shelltender/client update)
- Cross-filesystem file upload errors with Docker volumes
- WebSocket connection issues with port configuration
- node-pty version mismatch in containers

### Removed
- Legacy HTML-based frontend (frontend-legacy directory)
- Static file serving from backend server
- Docker services for legacy frontend
- References to xterm-direct

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