#!/bin/bash

# Cleanup script for removing legacy frontend files
# This script removes the old HTML-based frontend that has been replaced by the React app

echo "🧹 Cleaning up legacy frontend files..."

# Remove frontend-legacy directory
if [ -d "frontend-legacy" ]; then
    echo "Removing frontend-legacy directory..."
    rm -rf frontend-legacy
    echo "✅ Removed frontend-legacy"
else
    echo "⏭️  frontend-legacy directory not found"
fi

# Remove xterm-direct directory if it exists
if [ -d "xterm-direct" ]; then
    echo "Removing xterm-direct directory..."
    rm -rf xterm-direct
    echo "✅ Removed xterm-direct"
else
    echo "⏭️  xterm-direct directory not found"
fi

# Clean up legacy files from projects directory (if any)
echo "Checking for legacy files in projects directory..."
find ./projects -name "frontend-legacy" -type d -exec rm -rf {} + 2>/dev/null || true
find ./projects -name "xterm-direct" -type d -exec rm -rf {} + 2>/dev/null || true

echo "✨ Legacy cleanup complete!"
echo ""
echo "Note: The application now uses:"
echo "  - React frontend in /simple/frontend"
echo "  - @shelltender/client for terminal integration"
echo "  - No more iframe-based terminals"