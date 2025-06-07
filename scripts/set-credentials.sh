#!/bin/bash

# Script to set GitHub credentials as environment variables
# Usage: source ./scripts/set-credentials.sh

echo "Setting up GitHub credentials for PocketDev"
echo "==========================================="
echo ""

# Read GitHub username
read -p "Enter your GitHub username: " github_username

# Read GitHub personal access token (hidden input)
read -s -p "Enter your GitHub personal access token: " github_token
echo ""

# Export as environment variables
export GITHUB_PERSONAL_USERNAME="$github_username"
export GITHUB_PERSONAL_TOKEN="$github_token"

echo ""
echo "✅ Credentials set successfully!"
echo ""
echo "To make these permanent, add the following to your ~/.bashrc or ~/.zshrc:"
echo ""
echo "export GITHUB_PERSONAL_USERNAME=\"$github_username\""
echo "export GITHUB_PERSONAL_TOKEN=\"your-token-here\""
echo ""
echo "Remember to source this script: source ./scripts/set-credentials.sh"