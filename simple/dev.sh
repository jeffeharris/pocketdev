#!/bin/bash

echo "Starting PocketDev in development mode..."

# Stop any existing containers
docker-compose down

# Start with dev overrides
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Wait for container to be ready
sleep 5

# Install dependencies if needed
echo "Installing dependencies..."
docker exec pocketdev-project-manager bash -c "cd /app/server && npm install"
docker exec pocketdev-project-manager bash -c "cd /app/shelltender-client && npm install"

# Start the services with hot reloading
echo "Starting services with hot reloading..."

# Start React dev server
docker exec -d pocketdev-project-manager bash -c "cd /app/shelltender-client && npm run dev"

# Start backend with nodemon
docker exec -d pocketdev-project-manager bash -c "cd /app/server && npm run dev"

echo "Development environment started!"
echo ""
echo "Services available at:"
echo "  - React app: http://localhost:3008"
echo "  - API: http://localhost:3005"
echo "  - Shelltender WS: ws://localhost:8080"
echo ""
echo "Logs:"
echo "  - All logs: docker logs -f pocketdev-project-manager"
echo "  - Backend only: docker exec pocketdev-project-manager bash -c 'cd /app/server && npm run dev'"
echo ""
echo "Hot reloading is enabled - just save your files!"