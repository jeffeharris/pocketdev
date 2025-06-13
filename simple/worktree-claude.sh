#!/bin/bash

# Wrapper script for ttyd to launch Claude in tmux sessions for persistence
# Usage: ttyd passes the worktree path as a query parameter
# Format: /path/to/worktree or with resume: /path/to/worktree@resume=sessionId

# ttyd with -a flag passes URL arguments as command line args
WORKTREE=""
RESUME_SESSION=""

# Set up environment for Ink rendering in tmux
export TERM=xterm-256color
export COLORTERM=truecolor
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# Parse arguments
if [ ! -z "$1" ]; then
    ARG="$1"
    
    # Check if we have resume parameter (contains @resume=)
    if [[ "$ARG" == *"@resume="* ]]; then
        # Extract worktree path and resume session
        WORKTREE="${ARG%%@resume=*}"
        RESUME_SESSION="${ARG#*@resume=}"
    else
        WORKTREE="$ARG"
    fi
    
    # URL decode the path
    WORKTREE=$(echo "$WORKTREE" | sed 's/%2F/\//g' | sed 's/%20/ /g')
fi

if [ -z "$WORKTREE" ]; then
    echo "Welcome to Claude Project Manager"
    echo "================================"
    echo ""
    echo "No worktree specified. Please use the project dashboard to create and access projects."
    echo ""
    echo "Visit: http://localhost:3005/frontend/project-dashboard-v2.html"
    exec bash
else
    # Extract task ID from worktree path (e.g., /projects/2e2d632f-task-44509b74 -> task-44509b74)
    SESSION_NAME=$(basename "$WORKTREE")
    
    # Create tmux-friendly session name (replace problematic characters)
    TMUX_SESSION_NAME="claude-$(echo "$SESSION_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')"
    
    if [ -d "$WORKTREE" ]; then
        cd "$WORKTREE"
        
        # Check if tmux session exists
        if tmux has-session -t "$TMUX_SESSION_NAME" 2>/dev/null; then
            echo "Reconnecting to existing session: $TMUX_SESSION_NAME"
            echo "Task: $SESSION_NAME"
            echo ""
            # Attach to existing session
            exec tmux attach-session -t "$TMUX_SESSION_NAME"
        else
            echo "Creating new persistent session: $TMUX_SESSION_NAME"
            echo "Task: $SESSION_NAME"
            echo "tmux persistence enabled"
            echo ""
            
            # Create a marker to track if we've used this worktree before
            MARKER_DIR="/root/.pocketdev-sessions"
            mkdir -p "$MARKER_DIR"
            SESSION_MARKER="$MARKER_DIR/${SESSION_NAME}.used"
            
            # Check if we have a stored session ID for this worktree
            SESSION_FILE="$MARKER_DIR/${SESSION_NAME}.session"
            
            # Build the command to run in tmux
            if [ ! -z "$RESUME_SESSION" ]; then
                echo "Resuming Claude thread..."
                echo "Session ID: ${RESUME_SESSION:0:8}..."
                CMD="claude --resume \"$RESUME_SESSION\""
            elif [ -f "$SESSION_FILE" ]; then
                # We have a stored session ID, try to resume it
                SESSION_ID=$(cat "$SESSION_FILE")
                echo "Resuming Claude session..."
                echo "Session ID: ${SESSION_ID:0:8}..."
                CMD="claude --resume \"$SESSION_ID\""
            elif [ -f "$SESSION_MARKER" ]; then
                # We've used this worktree before but don't have a session ID
                echo "Continuing previous Claude session..."
                CMD="claude --continue"
            else
                # First time in this worktree
                touch "$SESSION_MARKER"
                
                # Check if there's a prompt file
                PROMPT_FILE="$WORKTREE/.claude-prompt"
                if [ -f "$PROMPT_FILE" ]; then
                    # Read the prompt and delete the file
                    PROMPT=$(cat "$PROMPT_FILE")
                    rm -f "$PROMPT_FILE"
                    echo "Starting Claude with task instructions..."
                    CMD="claude \"$PROMPT\""
                else
                    echo "Starting new Claude session..."
                    echo "Tip: Your conversation will be automatically resumed next time!"
                    CMD="claude"
                fi
            fi
            
            # Create new tmux session and attach
            # Important: Set proper working directory with -c flag
            # Export environment variables for Ink rendering
            tmux new-session -d -s "$TMUX_SESSION_NAME" -c "$WORKTREE" \
                "export TERM=xterm-256color; export COLORTERM=truecolor; export LANG=en_US.UTF-8; export LC_ALL=en_US.UTF-8; $CMD"
            exec tmux attach-session -t "$TMUX_SESSION_NAME"
        fi
    else
        echo "Error: Worktree directory not found: $WORKTREE"
        echo ""
        echo "Please check the project dashboard."
        exec bash
    fi
fi