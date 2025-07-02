# PocketDev Makefile
.PHONY: help dev prod up down restart logs shell clean migrate build build-ai-base build-all status test

# Default target
help:
	@echo "PocketDev Development Commands:"
	@echo "  make dev        - Start in development mode with hot reloading"
	@echo "  make prod       - Start in production mode"
	@echo "  make up         - Start containers (production)"
	@echo "  make down       - Stop and remove containers"
	@echo "  make restart    - Restart containers"
	@echo "  make logs       - Show container logs"
	@echo "  make shell      - Open shell in project-manager container"
	@echo "  make clean      - Clean up containers, volumes, and data"
	@echo "  make migrate    - Run shelltender migration for tasks"
	@echo "  make build        - Rebuild service containers"
	@echo "  make build-ai-base - Build AI base image with all development tools"
	@echo "  make build-all    - Build AI base image and all service containers"
	@echo "  make status     - Show container status"
	@echo "  make test       - Run tests"

# Development mode with BOTH frontends
dev:
	@echo "Starting PocketDev with both frontends..."
	@docker-compose down
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
	@echo "\n✓ Starting services (this may take a moment for dependencies to install)..."
	@echo "\nFrontends:"
	@echo "  Legacy:        http://localhost:3008"
	@echo "  New (React):   http://localhost:5173"
	@echo "\nBackend:"
	@echo "  API:           http://localhost:3005"
	@echo "  Shelltender:   ws://localhost:8080"
	@echo "\nView logs: make logs"
	@echo "\nNote: Services may take 30-60 seconds to be fully ready on first run."

# Production mode
prod:
	@echo "Starting PocketDev in production mode..."
	@docker-compose up -d
	@echo "\n✓ Production environment started!"
	@echo "\nServices:"
	@echo "  React app:     http://localhost:3008"
	@echo "  API:           http://localhost:3005"
	@echo "  Shelltender:   ws://localhost:8080"

# Basic docker-compose commands
up:
	@docker-compose up -d
	@echo "✓ Containers started"

down:
	@docker-compose down
	@echo "✓ Containers stopped"

restart:
	@docker-compose restart
	@echo "✓ Containers restarted"

# View logs
logs:
	@docker-compose logs -f

# Open shell in container
shell:
	@docker exec -it pocketdev-project-manager bash

# Clean everything
clean:
	@echo "Cleaning up containers and volumes..."
	@docker-compose down -v
	@echo "✓ Containers and volumes removed"
	@echo "Note: Database files in ./data are preserved"

# Run shelltender migration
migrate:
	@echo "Running shelltender migration..."
	@curl -X POST http://localhost:3005/api/migrate-to-shelltender
	@echo "\n✓ Migration complete"

# Build containers
build:
	@echo "Building containers..."
	@docker-compose build
	@echo "✓ Build complete"

# Build AI base image with all AI tools
build-ai-base:
	@echo "Building PocketDev AI base image with all development tools..."
	@docker build -f Dockerfile.ai-base -t pocketdev/ai-base:latest -t pocketdev/ai-base:1.0 .
	@echo "✓ AI base image built with:"
	@echo "  - AI Agents: Claude CLI, OpenAI Codex, Google Gemini, Aider"
	@echo "  - Dev Tools: Docker, GitHub CLI, ccusage"
	@echo "  - Package Managers: npm, yarn, pnpm"
	@echo "  - Testing: Jest, Mocha, ESLint, Prettier"
	@echo "  - Databases: PostgreSQL/MySQL/Redis clients"

# Build all images including base
build-all: build-ai-base build
	@echo "✓ All images built successfully"

# Show status
status:
	@echo "Container Status:"
	@docker-compose ps
	@echo "\nHealth Check:"
	@curl -s http://localhost:3005/api/health | jq . || echo "API not responding"

# Run tests
test:
	@echo "Running tests..."
	@docker exec pocketdev-project-manager bash -c "cd /app/server && npm test"

# Test the new API endpoints
test-api:
	@./scripts/test-api.sh

# Development shortcuts
logs-backend:
	@docker exec pocketdev-project-manager bash -c "cd /app/server && npm run dev"

logs-frontend:
	@docker exec pocketdev-project-manager bash -c "cd /app/shelltender-client && npm run dev"

# Database operations
db-shell:
	@docker exec -it pocketdev-project-manager sqlite3 /app/data/pocketdev.db

db-backup:
	@mkdir -p backups
	@docker exec pocketdev-project-manager sqlite3 /app/data/pocketdev.db ".backup /tmp/backup.db"
	@docker cp pocketdev-project-manager:/tmp/backup.db ./backups/pocketdev-$(shell date +%Y%m%d-%H%M%S).db
	@echo "✓ Database backed up to ./backups/"

# Git operations (for convenience)
commit:
	@git add -A
	@git commit -m "$(m)" || echo "Commit message required: make commit m='your message'"

push:
	@git push origin $(shell git branch --show-current)