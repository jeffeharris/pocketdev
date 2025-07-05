#!/bin/bash

# Fix permissions for directories that pocketdev needs to write to
# This ensures volume-mounted directories are writable
if [ -d "/projects" ] && [ ! -w "/projects" ]; then
    echo "Fixing /projects directory permissions..."
    # Try to fix permissions if we can (will fail gracefully if not root)
    chown pocketdev:pocketdev /projects 2>/dev/null || true
fi

if [ -d "/app/data" ]; then
    # Ensure data directory structure exists with correct permissions
    mkdir -p /app/data/shelltender-sessions
    # Try to fix permissions if we can
    chown pocketdev:pocketdev /app/data /app/data/shelltender-sessions 2>/dev/null || true
fi

# Clean up bloated .gitconfig if it exists
GITCONFIG="$HOME/.gitconfig"
if [ -f "$GITCONFIG" ]; then
    SIZE=$(stat -c%s "$GITCONFIG" 2>/dev/null || stat -f%z "$GITCONFIG" 2>/dev/null || echo 0)
    if [ "$SIZE" -gt 102400 ]; then  # 100KB
        echo "Warning: .gitconfig is ${SIZE} bytes, cleaning up..."
        rm -f "$GITCONFIG"
    fi
fi

# Execute the original command
exec "$@"