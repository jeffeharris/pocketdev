#!/bin/bash

# Run tests without npm install (for development)
# This assumes vitest is available globally or in node_modules

echo "Note: This script requires Vitest to be installed."
echo "If tests fail to run, please run: npm install"
echo ""

# Check if node_modules exists and has vitest
if [ -d "node_modules/vitest" ]; then
    echo "Running tests with local Vitest..."
    node node_modules/vitest/vitest.mjs "$@"
elif command -v vitest &> /dev/null; then
    echo "Running tests with global Vitest..."
    vitest "$@"
else
    echo "Error: Vitest not found!"
    echo "Please run: npm install"
    exit 1
fi