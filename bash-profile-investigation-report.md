# Bash Profile Configuration Investigation Report

## Current Configuration Flow

### 1. Container Image Build Phase

#### Base Image (Dockerfile.ai-base)
- Creates `pocketdev` user with useradd
- Sets up npm global directory for pocketdev user
- Configures environment variables:
  - `NPM_CONFIG_PREFIX=/home/pocketdev/.npm-global`
  - `PATH` includes npm global bin and Python user bin
  - API keys placeholders (empty by default)
- Runs git config globally to trust all directories (as both root and pocketdev)

#### Shelltender Image (Dockerfile.shelltender)
- Builds on top of ai-base
- **Copies system-wide bash configuration**: `/etc/bash.bashrc`
- Creates empty `/home/pocketdev/.bashrc` (just touches it)
- Copies wrapper scripts but **they are not used**:
  - `/usr/local/bin/pocketdev-shell` (has --norc --noprofile which would skip profiles!)
  - `/usr/local/bin/pocketdev-run`

### 2. Runtime Terminal Creation

#### Backend Terminal Service (terminal.service.js)
When creating a terminal session, passes these environment variables:
- `TASK_ID`: Task identifier
- `DB_SESSION_ID`: Database session ID
- `WORKTREE_PATH`: Git worktree path
- `TERM`: xterm-256color
- `PS1_ENV`: Simple prompt format
- `TASK_NAME`: Human-readable task name
- `HISTFILE`: Task-specific history file
- `HISTSIZE`: 10000
- `HISTFILESIZE`: 20000
- `GIT_USER_NAME`: From git config
- `GIT_USER_EMAIL`: From git config

#### Shelltender Service (shelltender-service.js)
- Receives the environment from backend
- Creates session with command: `/bin/bash`
- Uses args: `['--login', '-i']` (interactive login shell)
- This means bash WILL load profiles in this order:
  1. `/etc/profile` (system-wide)
  2. `/etc/bash.bashrc` (sourced by /etc/profile on Ubuntu)
  3. `~/.bash_profile` or `~/.bash_login` or `~/.profile` (first found)
  4. `~/.bashrc` (if sourced by profile)

### 3. Bash Configuration Files

#### /etc/bash.bashrc (system-wide)
This is the main configuration file that gets loaded. It includes:
- Smart prompt functions that show git branch and relative paths
- Context-aware prompt that shows after directory changes or screen-filling commands
- Command wrappers for claude, npm, docker, make, clear that trigger context display
- Git aliases (gs, ga, gc, etc.)
- History configuration
- Git user configuration from environment variables
- Welcome message for PocketDev terminals

#### /home/pocketdev/.bashrc
- Just sources `/etc/bash.bashrc`
- Exists to override Ubuntu's default bashrc

### 4. Configuration Touchpoints

1. **Dockerfile.ai-base**: Sets up user and base environment
2. **Dockerfile.shelltender**: Copies bash config files
3. **terminal.service.js**: Sets environment variables for each session
4. **shelltender-service.js**: Spawns bash with --login flag
5. **/etc/bash.bashrc**: Main configuration loaded by all shells
6. **/home/pocketdev/.bashrc**: Minimal file that sources system bashrc

### 5. Root vs Pocketdev User

Currently:
- **Root user**: Gets default Ubuntu bash configuration (no custom config)
- **Pocketdev user**: Gets custom PocketDev configuration via /etc/bash.bashrc

The system-wide `/etc/bash.bashrc` is loaded for ALL users, but the custom prompt and features only activate when certain environment variables (like `TASK_ID`) are present.

### 6. Unused/Legacy Components

- **pocketdev-shell.sh**: Installed but not used, would skip profiles with --norc --noprofile
- **docker-entrypoint.sh**: Used by backend, handles permissions but not bash config
- **docker-entrypoint-secure.sh**: Used in secure mode, handles UID/GID mapping

## Issues Identified

1. **Inconsistent root configuration**: Root user doesn't get the same prompt/features
2. **Wrapper scripts installed but unused**: pocketdev-shell could interfere if used
3. **Multiple git config calls**: Both in Dockerfile and at runtime
4. **PS1_ENV passed but may not work**: PS1 isn't inherited normally by bash

## Recommendations for Centralization

1. **Use /etc/bash.bashrc for ALL users**: The current approach is correct - it's already centralized
2. **Remove unused wrapper scripts**: Delete pocketdev-shell.sh to avoid confusion
3. **Ensure root gets same config**: The /etc/bash.bashrc should work for root too
4. **Consider /etc/profile.d/**: Could add a script there for login-shell-only config
5. **Remove redundant git configs**: Handle git configuration in one place only