#!/bin/bash
# Start script for secure Docker setup with automatic UID/GID detection

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*"
}

error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

# Detect host UID/GID
export HOST_UID=$(id -u)
export HOST_GID=$(id -g)

log "Starting PocketDev with secure configuration"
log "Host user: $(whoami) (UID=$HOST_UID, GID=$HOST_GID)"

# Check if .env exists for secrets
if [ ! -f .env ]; then
    error ".env file not found!"
    echo "Please create .env with required secrets:"
    echo "  ANTHROPIC_API_KEY=your_key_here"
    echo "  OPENAI_API_KEY=your_key_here"
    echo "  GITHUB_TOKEN=your_token_here"
    echo "  ENCRYPTION_KEY=your_encryption_key_here"
    exit 1
fi

# Source .env file (handle different line endings)
if [ -f .env ]; then
    # Remove carriage returns and source
    set -a
    source <(tr -d '\r' < .env)
    set +a
fi

# Validate required environment variables
required_vars=(
    "ANTHROPIC_API_KEY"
    "GITHUB_TOKEN"
    "ENCRYPTION_KEY"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    error "Missing required environment variables:"
    printf '%s\n' "${missing_vars[@]}"
    exit 1
fi

# Build base image if needed
if ! docker image inspect pocketdev/base-secure:latest >/dev/null 2>&1; then
    log "Building secure base image..."
    docker build -f Dockerfile.base-secure -t pocketdev/base-secure:latest .
fi

# Check if we need to rebuild images
if [ "$1" == "--build" ] || [ "$1" == "-b" ]; then
    log "Building all secure images..."
    docker-compose -f docker-compose-secure.yml build
fi

# Start services
log "Starting services..."
docker-compose -f docker-compose-secure.yml up -d

# Wait for services to be healthy
log "Waiting for services to be healthy..."
services=("shelltender-secure" "backend-secure" "frontend-secure")
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    all_healthy=true
    
    for service in "${services[@]}"; do
        health=$(docker inspect --format='{{.State.Health.Status}}' $service 2>/dev/null || echo "not found")
        if [ "$health" != "healthy" ]; then
            all_healthy=false
            break
        fi
    done
    
    if $all_healthy; then
        log "All services are healthy!"
        break
    fi
    
    attempt=$((attempt + 1))
    echo -n "."
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    error "Services failed to become healthy"
    docker-compose -f docker-compose-secure.yml ps
    exit 1
fi

# Show service status
log "Service status:"
docker-compose -f docker-compose-secure.yml ps

log "PocketDev is running securely!"
log "Frontend: http://localhost:5173"
log "Backend API: http://localhost:3005"
log "Shelltender: http://localhost:8080"

# Show logs if requested
if [ "$2" == "--logs" ] || [ "$2" == "-l" ]; then
    docker-compose -f docker-compose-secure.yml logs -f
fi