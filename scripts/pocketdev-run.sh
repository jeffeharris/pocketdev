#!/bin/bash
# PocketDev run wrapper script
# Executes commands in the PocketDev environment

# Set up environment
export HOME=/home/pocketdev
export USER=pocketdev

# Change to the working directory if specified
if [ -n "$WORKTREE_PATH" ]; then
    cd "$WORKTREE_PATH" 2>/dev/null || cd /projects
else
    cd /projects
fi

# Execute the command
exec "$@"