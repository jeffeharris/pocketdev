#!/bin/sh
# Backend entrypoint script - handles permissions dynamically

# If running as root, fix permissions
if [ "$(id -u)" = "0" ]; then
    echo "Running as root, fixing permissions..."
    # Ensure directories exist
    mkdir -p /projects /app/data
    # Fix ownership to match mounted volumes
    chown -R $(stat -c "%u:%g" /projects) /projects 2>/dev/null || true
    chown -R $(stat -c "%u:%g" /app/data) /app/data 2>/dev/null || true
fi

# Execute the main command
exec "$@"