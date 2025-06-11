#!/bin/bash

echo "🚀 PocketDev Project Manager"
echo "=========================="
echo ""

# Check for GitHub token
if [ ! -z "$GITHUB_TOKEN" ]; then
    echo "✅ GitHub token detected"
else
    echo "ℹ️  No GITHUB_TOKEN found"
    echo "   You can set it later in the web UI settings"
fi

echo ""
echo "Building Claude base image..."
docker compose --profile build build claude-ttyd

echo ""
echo "Starting services..."

# Start the project manager and ttyd server
docker compose up -d project-manager claude-ttyd-server

# Wait for it to be healthy
echo "Waiting for services to be ready..."
sleep 3

# Check health
if curl -s http://localhost:3005/api/health > /dev/null; then
    echo ""
    echo "✅ Project Manager is running!"
    echo ""
    echo "📱 Open in your browser:"
    echo "   http://localhost:3005/frontend/project-dashboard-v2.html"
    echo ""
    echo "Features:"
    echo "  • Configure GitHub token in Settings (⚙️)"
    echo "  • Browse and select from your GitHub repos"
    echo "  • Launch isolated Claude instances"
    echo "  • Manage git operations via web UI"
    echo ""
    echo "To stop: docker compose down"
else
    echo "❌ Failed to start. Check logs with: docker compose logs"
fi