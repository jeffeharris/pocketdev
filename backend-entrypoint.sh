#!/bin/sh
# Backend entrypoint script

# Configure git to trust project directories (needed for git operations as pocketdev user)
git config --global --add safe.directory '*'

# Set umask to make new files/dirs group-writable (775 for dirs, 664 for files)
# This helps with permission issues when multiple containers access the same volumes
umask 002

# Execute the main command
exec "$@"