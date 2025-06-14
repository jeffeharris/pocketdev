# PocketDev Makefile
# Simplifies common development tasks

.PHONY: help build dev stop restart logs clean test quick-test

# Default target - show help
help:
	@echo "PocketDev Development Commands:"
	@echo "  make build      - Build Docker images"
	@echo "  make dev        - Start all services in development mode"
	@echo "  make stop       - Stop all services"
	@echo "  make restart    - Restart all services"
	@echo "  make logs       - Show logs from all services"
	@echo "  make clean      - Clean up containers and volumes"
	@echo "  make test       - Run all tests"
	@echo "  make quick-test - Test the quick task API"

# Build Docker images
build:
	@echo "🔨 Building Docker images..."
	./scripts/build-docker.sh
	@echo "✅ Build complete!"

# Start development environment
dev: logs
	@echo "🚀 Starting development environment..."
	@echo "Starting backend..."
	@cd local-backend && npm run dev > $(PWD)/logs/backend.log 2>&1 & echo $$! > $(PWD)/logs/backend.pid
	@sleep 2
	@echo "Starting frontend..."
	@cd web && npm run dev > $(PWD)/logs/frontend.log 2>&1 & echo $$! > $(PWD)/logs/frontend.pid
	@sleep 2
	@echo "✅ Services started!"
	@echo "Frontend: http://localhost:5173"
	@echo "Backend: http://localhost:3001"
	@echo "Quick Task: http://localhost:5173/quick"

# Ensure logs directory exists
logs:
	@mkdir -p logs

# Docker Compose commands
dc-up:
	@echo "🐳 Starting services with docker-compose..."
	docker-compose -f docker-compose.dev.yml up -d
	@echo "✅ Services started!"
	@echo "Frontend: http://localhost:5173"
	@echo "Backend: http://localhost:3001"

dc-down:
	@echo "🐳 Stopping docker-compose services..."
	docker-compose -f docker-compose.dev.yml down

dc-build:
	@echo "🐳 Building docker-compose services..."
	docker-compose -f docker-compose.dev.yml build

dc-logs:
	docker-compose -f docker-compose.dev.yml logs -f

# Stop all services
stop:
	@echo "🛑 Stopping services..."
	@-[ -f logs/backend.pid ] && kill `cat logs/backend.pid` && rm logs/backend.pid
	@-[ -f logs/frontend.pid ] && kill `cat logs/frontend.pid` && rm logs/frontend.pid
	@-pkill -f "node server.js" 2>/dev/null || true
	@-pkill -f "vite" 2>/dev/null || true
	@echo "✅ Services stopped!"

# Restart all services
restart: stop build dev

# Show logs
logs:
	@echo "📋 Showing logs (Ctrl+C to exit)..."
	@tail -f logs/backend.log logs/frontend.log 2>/dev/null || echo "No logs found. Run 'make dev' first."

# Clean up
clean:
	@echo "🧹 Cleaning up..."
	@-docker ps -a | grep pocketdev | awk '{print $$1}' | xargs -r docker rm -f
	@-rm -rf /tmp/pocketdev-workspaces/*
	@-rm -f logs/*.pid
	@-rm -f logs/*.log
	@echo "✅ Cleanup complete!"

# Run tests
test:
	@echo "🧪 Running tests..."
	@cd local-backend && npm test

# Quick test of the API
quick-test:
	@echo "🎯 Testing quick task API..."
	@curl -X POST http://localhost:3001/api/container/quick-task \
		-H "Content-Type: application/json" \
		-d '{"description": "Add a hello world button to the home page", "type": "feature"}' \
		| jq '.' || echo "❌ API test failed. Is the backend running?"

# Create necessary directories
$(shell mkdir -p logs)