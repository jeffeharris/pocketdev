#!/bin/bash

# Fix git safe directory for all repositories
echo "Setting up git safe directories..."
git config --global --add safe.directory '*'

# Execute the original command
exec "$@"