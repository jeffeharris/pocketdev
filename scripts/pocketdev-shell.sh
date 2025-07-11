#!/bin/bash
# PocketDev shell wrapper script
# Provides a restricted shell environment for task terminals

# Set up environment
export PS1="\u@\h:\w\$ "
export HOME=/home/pocketdev
export USER=pocketdev

# Change to the working directory if specified
if [ -n "$WORKTREE_PATH" ]; then
    cd "$WORKTREE_PATH" 2>/dev/null || cd /projects
else
    cd /projects
fi

# Execute bash with appropriate settings
exec /bin/bash --norc --noprofile "$@"