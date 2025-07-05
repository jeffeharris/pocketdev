#!/bin/bash

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