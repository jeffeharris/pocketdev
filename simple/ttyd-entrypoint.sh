#!/bin/bash

# Start the session API in the background
echo "Starting TTyd Session API on port ${SESSION_API_PORT:-3006}..."
node /usr/local/bin/ttyd-session-api.js &
SESSION_API_PID=$!

# Start ttyd
echo "Starting TTyd on port 7681..."
# Try to disable scroll sensitivity to prevent arrow key conversion
ttyd -p 7681 -W -a \
    -t scrollSensitivity=0 \
    /usr/local/bin/worktree-claude &
TTYD_PID=$!

# Function to handle shutdown
shutdown() {
    echo "Shutting down..."
    kill $SESSION_API_PID $TTYD_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap shutdown SIGTERM SIGINT

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?