#!/bin/bash

# Development Docker script with comprehensive logging

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🐳 PocketDev Docker Development Environment${NC}"
echo "============================================"

# Check for required environment variables
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${RED}❌ Error: ANTHROPIC_API_KEY not set${NC}"
    echo "Please set your API key:"
    echo "  export ANTHROPIC_API_KEY='your-key-here'"
    exit 1
fi

# Function to show logs
show_logs() {
    echo -e "\n${BLUE}📋 Viewing logs (Ctrl+C to stop)${NC}"
    echo -e "${YELLOW}Tip: Use 'docker-compose -f docker-compose.dev.yml logs -f [service]' to see specific service${NC}\n"
    docker-compose -f docker-compose.dev.yml logs -f
}

# Function to cleanup
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
    docker-compose -f docker-compose.dev.yml down
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Trap exit signal
trap cleanup EXIT

# Parse arguments
case "$1" in
    "build")
        echo -e "${BLUE}🔨 Building all containers...${NC}"
        docker-compose -f docker-compose.dev.yml build
        echo -e "${GREEN}✅ Build complete${NC}"
        ;;
    
    "up")
        echo -e "${BLUE}🚀 Starting all services...${NC}"
        docker-compose -f docker-compose.dev.yml up -d
        
        echo -e "\n${GREEN}✅ Services started!${NC}"
        echo -e "  Frontend: http://localhost:5173"
        echo -e "  Backend:  http://localhost:3001"
        echo -e "\n${YELLOW}Waiting for services to be ready...${NC}"
        
        # Wait for backend to be ready
        sleep 5
        
        # Check health
        if curl -s http://localhost:3001/api/debug > /dev/null; then
            echo -e "${GREEN}✅ Backend is ready!${NC}"
        else
            echo -e "${RED}⚠️  Backend might not be ready yet${NC}"
        fi
        
        echo -e "\n${BLUE}📋 Monitoring logs...${NC}"
        show_logs
        ;;
    
    "logs")
        show_logs
        ;;
    
    "test")
        echo -e "${BLUE}🧪 Running container test...${NC}"
        # First ensure services are up
        docker-compose -f docker-compose.dev.yml up -d
        sleep 5
        
        # Run test
        ./scripts/test-container.sh
        ;;
    
    "shell")
        SERVICE="${2:-backend}"
        echo -e "${BLUE}🐚 Opening shell in $SERVICE container...${NC}"
        docker-compose -f docker-compose.dev.yml exec $SERVICE sh
        ;;
    
    "down")
        cleanup
        exit 0
        ;;
    
    *)
        echo "Usage: $0 {build|up|logs|test|shell|down}"
        echo ""
        echo "Commands:"
        echo "  build  - Build all Docker containers"
        echo "  up     - Start all services and show logs"
        echo "  logs   - Show logs from all services"
        echo "  test   - Run container integration test"
        echo "  shell  - Open shell in a container (default: backend)"
        echo "  down   - Stop and remove all containers"
        echo ""
        echo "Examples:"
        echo "  $0 build           # Build containers"
        echo "  $0 up              # Start everything"
        echo "  $0 shell frontend  # Shell into frontend"
        echo "  $0 logs            # View all logs"
        exit 1
        ;;
esac