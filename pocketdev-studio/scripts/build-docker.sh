#!/bin/bash

# Build the AI Developer Docker image

echo "Building PocketDev AI Developer Docker image..."

# Navigate to the docker directory
cd "$(dirname "$0")/../docker/ai-developer" || exit 1

# Build the image
docker build -t pocketdev/ai-developer:latest .

if [ $? -eq 0 ]; then
    echo "✅ Docker image built successfully!"
    echo ""
    echo "Image: pocketdev/ai-developer:latest"
    echo ""
    echo "You can now:"
    echo "1. Start the backend: cd local-backend && npm run dev"
    echo "2. Use the API to assign containerized tasks"
    echo ""
else
    echo "❌ Docker build failed!"
    exit 1
fi