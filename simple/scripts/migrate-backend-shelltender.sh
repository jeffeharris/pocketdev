#!/bin/bash
# Migration script to separate backend and shelltender services

set -e

echo "🚀 Starting backend/shelltender separation migration..."

# 1. Move backend files
echo "📦 Moving backend files..."
# Main server files
cp server/server.js backend/
cp server/app.js backend/
cp server/config.js backend/
cp server/github.js backend/
cp server/ai-session-monitor.js backend/
cp server/ai-state-tracker.js backend/
cp server/git-status-monitor.js backend/
cp server/notification-service.js backend/

# Controllers
cp -r server/controllers backend/

# Services
cp -r server/services backend/

# Database
cp -r server/db backend/

# 2. Move shelltender files
echo "📦 Moving shelltender files..."
cp server/shelltender-service.js shelltender/

# 3. Move shared utilities
echo "📦 Moving shared utilities..."
cp server/shelltender-client.js shared/

# 4. Create package.json for backend
echo "📝 Creating backend/package.json..."
cat > backend/package.json << 'EOF'
{
  "name": "pocketdev-backend",
  "version": "1.0.0",
  "description": "PocketDev Backend API Service",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.21.2",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "multer": "^1.4.5-lts.1",
    "sqlite3": "^5.1.7",
    "ws": "^8.18.0",
    "node-fetch": "^2.7.0",
    "crypto-js": "^4.2.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.9"
  }
}
EOF

# 5. Create package.json for shelltender
echo "📝 Creating shelltender/package.json..."
cat > shelltender/package.json << 'EOF'
{
  "name": "pocketdev-shelltender",
  "version": "1.0.0",
  "description": "PocketDev Shelltender Terminal Service",
  "main": "shelltender-service.js",
  "scripts": {
    "start": "node shelltender-service.js",
    "dev": "nodemon shelltender-service.js"
  },
  "dependencies": {
    "@shelltender/server": "^0.5.0",
    "express": "^4.21.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.1.9"
  }
}
EOF

# 6. Update import paths in backend files
echo "🔧 Updating import paths..."
# Update shelltender-client imports
find backend -name "*.js" -type f -exec sed -i "s|require('./shelltender-client')|require('../shared/shelltender-client')|g" {} \;
find backend -name "*.js" -type f -exec sed -i "s|require('../shelltender-client')|require('../../shared/shelltender-client')|g" {} \;

# 7. Create new Dockerfiles
echo "🐳 Creating Dockerfile.backend..."
cat > Dockerfile.backend-new << 'EOF'
FROM node:22-alpine AS base
RUN apk add --no-cache git openssh-client curl

FROM base AS backend
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S pocketdev && \
    adduser -S pocketdev -u 1001 -G pocketdev

# Copy package files
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy application code
COPY backend/ ./
COPY shared/ ./shared/

# Create necessary directories
RUN mkdir -p /projects /app/data && \
    chown -R pocketdev:pocketdev /app /projects

USER pocketdev

EXPOSE 3005

CMD ["node", "server.js"]
EOF

echo "🐳 Creating Dockerfile.shelltender..."
cat > Dockerfile.shelltender-new << 'EOF'
FROM node:22-alpine
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files
COPY shelltender/package*.json ./
RUN npm ci --only=production

# Copy application code
COPY shelltender/ ./

EXPOSE 8080

CMD ["node", "shelltender-service.js"]
EOF

# 8. Create updated docker-compose.yml
echo "🐳 Creating docker-compose-new.yml..."
cat > docker-compose-new.yml << 'EOF'
services:
  # Shelltender Terminal Service
  shelltender:
    build:
      context: .
      dockerfile: Dockerfile.shelltender-new
    container_name: shelltender
    volumes:
      - ${POCKETDEV_HOME:-~/.pocketdev}/data:/app/data
      - ${POCKETDEV_HOME:-~/.pocketdev}/projects:/projects
    ports:
      - "8080:8080"
    environment:
      - SHELLTENDER_PORT=8080
      - SHELLTENDER_DATA_DIR=/app/data/shelltender-sessions
      - SHELLTENDER_MONITOR_AUTH_KEY=pocketdev-monitor-key-2024
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
      - GOOGLE_API_KEY=${GOOGLE_API_KEY:-}
      - GEMINI_API_KEY=${GEMINI_API_KEY:-}
      - GITHUB_TOKEN=${GITHUB_TOKEN:-}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Backend API Service
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend-new
    container_name: backend
    user: pocketdev
    depends_on:
      - shelltender
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ${POCKETDEV_HOME:-~/.pocketdev}/projects:/projects
      - ~/.ssh:/home/pocketdev/.ssh:ro
      - pocketdev-settings:/home/pocketdev/.pocketdev
      - ${POCKETDEV_HOME:-~/.pocketdev}/data:/app/data
    ports:
      - "3005:3005"
    environment:
      - PROJECTS_DIR=/projects
      - GITHUB_TOKEN=${GITHUB_TOKEN:-}
      - HOME=/home/pocketdev
      - SHELLTENDER_API_URL=http://shelltender:8080
      - SHELLTENDER_WS_URL=ws://shelltender:8080/ws
      - SHELLTENDER_MONITOR_AUTH_KEY=pocketdev-monitor-key-2024
      - ENCRYPTION_KEY=${ENCRYPTION_KEY:-}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3005/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    
  # React Frontend
  frontend:
    image: node:22-alpine
    container_name: frontend
    working_dir: /app
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "5173:5173"
    environment:
      - NODE_ENV=development
      - VITE_API_URL=http://localhost:3005
      - VITE_USE_MOCKS=false
    command: sh -c "npm install && npm run dev -- --host 0.0.0.0"
    networks:
      - default

volumes:
  pocketdev-workspace:
  pocketdev-settings:
  pocketdev-data:
    external: true

networks:
  default:
    name: pocketdev-network
EOF

echo "✅ Migration script created!"
echo ""
echo "Next steps:"
echo "1. Review the changes"
echo "2. Run: ./scripts/migrate-backend-shelltender.sh"
echo "3. Test with: docker compose -f docker-compose-new.yml up"
echo "4. If everything works, replace the old files"