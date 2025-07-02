#!/bin/bash

# Create data directories for persistence
mkdir -p /app/data/shelltender-sessions/buffers

# Rebuild native modules for container (required for shelltender)
cd /app/server && npm rebuild

# Install and build React client
echo "Installing shelltender-client dependencies..."
cd /app/shelltender-client && npm install

# Start React dev server in background
echo "Starting React dev server..."
cd /app/shelltender-client && npm run dev &

# Start main project manager with shelltender
echo "Starting project manager..."
# Install nodemon if not already installed
cd /app/server && npm install

# Use nodemon for development hot reloading
cd /app/server && npm run dev