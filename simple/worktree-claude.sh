#!/bin/bash

# Wrapper script for ttyd to launch Claude in the correct worktree with optional tmux session persistence
# Usage: ttyd passes the worktree path as a query parameter
# Format: /path/to/worktree or /path/to/worktree@notmux for clean mode

# ttyd with -a flag passes URL arguments as command line args
# The URL ?arg=value passes the value as a command line argument
WORKTREE=""
USE_TMUX=true

# With ttyd -a, URL ?arg=value passes just the value
if [ ! -z "$1" ]; then
    ARG="$1"
    # Check if @notmux is appended
    if [[ "$ARG" == *"@notmux" ]]; then
        USE_TMUX=false
        WORKTREE="${ARG%@notmux}"
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
        
        if [ "$USE_TMUX" = true ]; then
            # Check if tmux session already exists
            if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
                # Just attach without any messages - for cleaner experience
                exec tmux attach-session -t "$SESSION_NAME"
            else
                # Check if there's a prompt file
                PROMPT_FILE="$WORKTREE/.claude-prompt"
                if [ -f "$PROMPT_FILE" ]; then
                    # Read the prompt and delete the file
                    PROMPT=$(cat "$PROMPT_FILE")
                    rm -f "$PROMPT_FILE"
                    # Create new tmux session with Claude and the prompt
                    tmux new-session -d -s "$SESSION_NAME" -c "$WORKTREE" claude "$PROMPT"
                else
                    # Create new tmux session and start Claude normally
                    tmux new-session -d -s "$SESSION_NAME" -c "$WORKTREE" claude
                fi
                exec tmux attach-session -t "$SESSION_NAME"
            fi
        else
            # Clean mode - use Claude's built-in session management
            # Since we're in a container, we need to check for sessions more intelligently
            
            # First, let's use Claude's --continue flag which will automatically
            # continue the most recent conversation in this directory
            cd "$WORKTREE"
            
            # Create a marker to track if we've used this worktree before
            MARKER_DIR="/root/.pocketdev-sessions"
            mkdir -p "$MARKER_DIR"
            SESSION_MARKER="$MARKER_DIR/${SESSION_NAME}.used"
            
            
            # Check if we have a stored session ID for this worktree
            SESSION_FILE="$MARKER_DIR/${SESSION_NAME}.session"
            
            if [ -f "$SESSION_FILE" ]; then
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
        fi
    else
        echo "Error: Worktree directory not found: $WORKTREE"
        echo ""
        echo "Please check the project dashboard."
        exec bash
    fi
fi