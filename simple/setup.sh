#!/bin/bash

echo "🚀 Setting up PocketDev Minimal..."

# Create test repository
echo "📦 Creating test git repository..."
mkdir -p test-repo
cd test-repo
git init
echo "# PocketDev Test Repo" > README.md
git add .
git commit -m "Initial commit"
git branch -m main
cd ..

# Install server dependencies
echo "📦 Installing server dependencies..."
cd server
npm install
cd ..

echo "✅ Setup complete!"
echo ""
echo "To start PocketDev:"
echo "  docker-compose up"
echo ""
echo "Then open: http://localhost:2424"