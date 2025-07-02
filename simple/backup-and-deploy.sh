#!/bin/bash

echo "🔄 PocketDev Backup and Deploy"
echo "=============================="
echo ""

# Create backup directory with timestamp
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Step 1: Backing up data..."

# 1. Backup projects directory (contains all worktrees)
if [ -d "./projects" ]; then
    echo "  - Backing up projects..."
    cp -r ./projects "$BACKUP_DIR/"
fi

# 2. Backup Docker volumes
echo "  - Backing up Docker volumes..."

# Export pocketdev-settings volume (contains credentials and settings)
docker run --rm -v pocketdev-settings:/data -v "$PWD/$BACKUP_DIR":/backup alpine tar czf /backup/pocketdev-settings.tar.gz -C /data .

# 3. Backup any local settings
if [ -f ".env" ]; then
    echo "  - Backing up .env file..."
    cp .env "$BACKUP_DIR/"
fi

# 4. Create a project state file
echo "  - Saving project state..."
docker-compose exec -T project-manager node -e "
const http = require('http');
http.get('http://localhost:3005/api/projects', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log(data));
});
" > "$BACKUP_DIR/projects-state.json" 2>/dev/null || echo "[]" > "$BACKUP_DIR/projects-state.json"

echo ""
echo "✅ Backup completed to: $BACKUP_DIR"
echo ""

# Ask for confirmation before rebuilding
read -p "🔨 Ready to rebuild and deploy? This will stop current services. (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 0
fi

echo ""
echo "🛑 Step 2: Stopping services..."
docker-compose down

echo ""
echo "🔨 Step 3: Rebuilding images..."
# No need to build ttyd image anymore

echo ""
echo "🚀 Step 4: Starting services..."
docker-compose up -d project-manager

echo ""
echo "♻️  Step 5: Restoring data..."

# Wait for services to be ready
echo "  - Waiting for services to start..."
sleep 5

# Check if services are healthy
if curl -s http://localhost:3005/api/health > /dev/null; then
    echo "  ✅ Services are healthy!"
else
    echo "  ⚠️  Services may still be starting..."
fi

echo ""
echo "📊 Deployment Summary:"
echo "====================="
echo ""
echo "✅ Data preserved:"
echo "  - All projects and worktrees"
echo "  - Claude sessions (in ~/.claude/)"
echo "  - Settings and credentials"
echo ""
echo "🔗 Access points:"
echo "  - Dashboard: http://localhost:3005/frontend/project-dashboard-v2.html"
echo "  - API: http://localhost:3005/api/"
echo "  - Shelltender WS: ws://localhost:8080/"
echo ""
echo "💾 Backup location: $BACKUP_DIR"
echo ""
echo "🔄 To restore from backup:"
echo "  ./restore-backup.sh $BACKUP_DIR"
echo ""
echo "✨ Deployment complete!"