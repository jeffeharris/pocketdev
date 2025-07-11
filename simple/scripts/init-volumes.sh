#!/bin/bash
# Initialize PocketDev external volume directories

set -e

# Load environment variables
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Use POCKETDEV_HOME or default to ~/.pocketdev
POCKETDEV_HOME=${POCKETDEV_HOME:-$HOME/.pocketdev}

echo "Initializing PocketDev volumes at: $POCKETDEV_HOME"

# Create directory structure
mkdir -p "$POCKETDEV_HOME/data/shelltender-sessions"
mkdir -p "$POCKETDEV_HOME/projects"

# Set permissions
chmod 755 "$POCKETDEV_HOME"
chmod 755 "$POCKETDEV_HOME/data"
chmod 755 "$POCKETDEV_HOME/projects"

echo "✅ PocketDev volume directories created:"
echo "   - Data: $POCKETDEV_HOME/data"
echo "   - Projects: $POCKETDEV_HOME/projects"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ Created .env file"
    echo "⚠️  Please edit .env to add your API keys"
fi

echo ""
echo "Setup complete! You can now run:"
echo "  docker compose up"