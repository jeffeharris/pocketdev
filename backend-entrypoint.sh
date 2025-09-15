#!/bin/sh
# Backend container entrypoint script

# Set up git configuration if GitHub token is available
if [ ! -z "$GITHUB_TOKEN" ]; then
    git config --global credential.helper '!f() { echo "username=x-access-token"; echo "password=$GITHUB_TOKEN"; }; f'
fi

# Set safe directory for git operations
git config --global --add safe.directory '*'

# Execute the main command
exec "$@"