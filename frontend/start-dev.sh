#!/bin/bash

# Get WSL IP address
WSL_IP=$(ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)

echo "Starting Vite dev server..."
echo "================================"
echo "Access the app at:"
echo "  From WSL:     http://localhost:5173"
echo "  From Windows: http://$WSL_IP:5173"
echo "================================"

# Start vite with host flag to allow external connections
npm run dev -- --host