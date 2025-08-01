# Terminal Configuration Improvements

## Overview
We've implemented several improvements to make the terminal experience more pleasant and functional, including proper bash initialization, custom prompts, and task-scoped command history that branches from the active terminal.

## Features Implemented

### 1. Proper Bash Initialization
- Added `command: '/bin/bash'` and `args: ['--login']` to terminal creation
- Ensures bash starts with proper profile loading
- Shows visible prompt immediately

### 2. Custom Bash Configuration
- Created `/backend/config/default-bashrc` with useful defaults
- Includes colored prompt: `user@pocketdev:~/path$ `
- Common aliases: `ll`, `la`, `gs` (git status), `gd` (git diff), etc.
- Git command completion
- Welcome message showing working directory and history count

### 3. Task-Scoped Command History with Branching
- Each task has a shared history file: `.pocketdev_task_history`
- **NEW**: When creating a new terminal tab, it copies history from the currently active tab
- This allows branching workflows where you build on commands from another tab
- History is not synced in real-time - each tab maintains its own history after creation
- Commands are immediately written to history file after execution

### 4. Environment Variables
- `TASK_ID`: Current task ID
- `WORKTREE_PATH`: Task's worktree directory
- `TERM`: Set to 'xterm-256color' for proper colors
- `PS1`: Custom prompt with colors
- `HISTFILE`: Points to task-scoped history file

## How History Branching Works

1. **Initial Tab**: Starts with empty or existing task history
2. **New Tab Creation**: 
   - Copies all history from the currently active tab
   - New tab starts where the active tab left off
   - Each tab then maintains its own history independently
3. **Benefits**:
   - Complex commands are available in new tabs
   - Build on work from other tabs without retyping
   - Natural workflow progression

## Example Workflow

```bash
# Tab 1: Figure out the right build command
npm install
npm run build -- --mode production --sourcemap
# Works! Now I want to test in another tab

# Create Tab 2 (inherits Tab 1's history)
# Can press ↑ to get the build command
npm run build -- --mode production --sourcemap
npm test

# Create Tab 3 (inherits Tab 2's history)
# Has access to both build and test commands
```

## Configuration Files

### `/backend/config/default-bashrc`
Default bash configuration sourced by all terminals. Includes:
- Aliases and prompt configuration
- History settings
- Git shortcuts
- Welcome message

### `/backend/controllers/terminal.controller.js`
Updated to:
- Set proper bash initialization parameters
- Configure task-scoped history
- Copy history from source terminal when specified
- Source default bashrc on startup

## Future Enhancements

1. **History Search**: Cross-tab history search functionality
2. **Persistent Aliases**: Task-specific alias definitions
3. **Template Environments**: Pre-configured environments for different project types
4. **History Export**: Export useful commands as documentation