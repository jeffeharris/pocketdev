#!/bin/bash

echo "Starting WebSocket test..."

# Start WebSocket listener in background
node test-websocket-split.js &
WS_PID=$!

# Wait for connection
sleep 2

echo "Triggering split layout update..."

# Update split layout
curl -X PUT \
  -H "Content-Type: application/json" \
  -d '{"mode":"split","orientation":"vertical","splitRatio":0.7}' \
  http://localhost:3005/api/projects/4d69792729dffb83/tasks/1dcbda95/split-layout

# Wait for result
wait $WS_PID
exit $?