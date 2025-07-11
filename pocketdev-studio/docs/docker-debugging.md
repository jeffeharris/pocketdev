# Docker Debugging Guide

## Quick Start

```bash
# Build and start everything
./scripts/dev-docker.sh build
./scripts/dev-docker.sh up

# In another terminal, run tests
./scripts/dev-docker.sh test
```

## Viewing Logs

### All Services
```bash
./scripts/dev-docker.sh logs
# or
docker-compose -f docker-compose.dev.yml logs -f
```

### Specific Service
```bash
# Frontend logs
docker-compose -f docker-compose.dev.yml logs -f frontend

# Backend logs
docker-compose -f docker-compose.dev.yml logs -f backend

# Last 100 lines
docker-compose -f docker-compose.dev.yml logs --tail=100 backend
```

### Container Task Logs
```bash
# Get the last container that ran
docker ps -a | grep pocketdev/ai-developer

# View its logs
docker logs <container-id>

# Or use the one-liner
docker logs $(docker ps -a -q -f "ancestor=pocketdev/ai-developer" -n 1)
```

## Debugging Common Issues

### 1. __dirname is not defined
**Fixed in**: `container-orchestrator.js`
```javascript
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

### 2. Container Can't Find Docker
**Solution**: Mount Docker socket
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

### 3. Permission Denied
**Check**:
- Docker socket permissions
- Workspace directory permissions
- API key is set

### 4. Task Fails to Start
**Debug Steps**:
1. Check backend logs: `docker-compose -f docker-compose.dev.yml logs backend`
2. Check Docker images: `docker images | grep pocketdev`
3. Try running manually: `docker run -it pocketdev/ai-developer:latest bash`

## Monitoring in Docker Desktop

1. Open Docker Desktop
2. Go to Containers tab
3. Click on `pocketdev` stack
4. You'll see all services with:
   - Real-time logs
   - CPU/Memory usage
   - Network activity
   - Volume mounts

## Shell Access

```bash
# Backend shell
./scripts/dev-docker.sh shell backend

# Frontend shell
./scripts/dev-docker.sh shell frontend

# Or directly
docker-compose -f docker-compose.dev.yml exec backend sh
```

## Inspecting Failed Tasks

```bash
# List task workspaces
ls -la /tmp/pocketdev-workspaces/

# Check a specific task's logs
cat /tmp/pocketdev-workspaces/<task-id>/logs/*.log

# Check results
cat /tmp/pocketdev-workspaces/<task-id>/results/session_result.json
```

## Performance Monitoring

```bash
# Real-time stats
docker stats

# Container resource usage
docker-compose -f docker-compose.dev.yml ps
```

## Clean Restart

```bash
# Stop everything
./scripts/dev-docker.sh down

# Remove old workspaces
rm -rf /tmp/pocketdev-workspaces/*

# Rebuild images
docker-compose -f docker-compose.dev.yml build --no-cache

# Start fresh
./scripts/dev-docker.sh up
```