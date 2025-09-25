#!/bin/bash

echo "Setting up pre-commit hooks for frontend..."

# Install packages
echo "Installing husky and lint-staged..."
npm install --save-dev husky lint-staged

# Initialize husky
echo "Initializing husky..."
npx husky install .husky

# Set up the pre-commit hook
echo "Setting up pre-commit hook..."
npx husky add .husky/pre-commit "cd frontend && npx lint-staged"

echo "Pre-commit hooks setup complete!"
echo ""
echo "The following checks will run on commit:"
echo "  - ESLint (with auto-fix)"
echo "  - TypeScript type checking"
echo "  - Prettier formatting (for json, css, md files)"
echo ""
echo "To test the hooks manually, run: npx lint-staged"