#!/bin/bash

# Wrapper script for ttyd to launch Claude in the correct worktree
# Usage: ttyd passes the worktree path as a query parameter
# Format: /path/to/worktree or with resume: /path/to/worktree&resume=sessionId

# ttyd with -a flag passes URL arguments as command line args
# The URL ?arg=value passes the value as a command line argument
WORKTREE=""
RESUME_SESSION=""

# With ttyd -a, URL ?arg=value passes just the value
# We encode resume session as path@resume=sessionId
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
    
    if [ -d "$WORKTREE" ]; then
        cd "$WORKTREE"
        
        # Create a marker to track if we've used this worktree before
        MARKER_DIR="/root/.pocketdev-sessions"
        mkdir -p "$MARKER_DIR"
        SESSION_MARKER="$MARKER_DIR/${SESSION_NAME}.used"
        
        # Check if we have a stored session ID for this worktree
        SESSION_FILE="$MARKER_DIR/${SESSION_NAME}.session"
        
        # If RESUME_SESSION is set from URL parameter, use it
        if [ ! -z "$RESUME_SESSION" ]; then
            echo "Resuming Claude thread..."
            echo "Session ID: ${RESUME_SESSION:0:8}..."
            echo ""
            exec claude --resume "$RESUME_SESSION"
        elif [ -f "$SESSION_FILE" ]; then
            # We have a stored session ID, try to resume it
            SESSION_ID=$(cat "$SESSION_FILE")
            echo "Resuming Claude session..."
            echo "Session ID: ${SESSION_ID:0:8}..."
            echo ""
            exec claude --resume "$SESSION_ID"
        elif [ -f "$SESSION_MARKER" ]; then
            # We've used this worktree before but don't have a session ID
            # Use --continue to continue the most recent conversation
            echo "Continuing previous Claude session..."
            echo ""
            exec claude --continue
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
                echo ""
                exec claude "$PROMPT"
            else
                echo "Starting new Claude session..."
                echo "Tip: Your conversation will be automatically resumed next time!"
                echo ""
                exec claude
            fi
        fi
    else
        echo "Error: Worktree directory not found: $WORKTREE"
        echo ""
        echo "Please check the project dashboard."
        exec bash
    fi
fi