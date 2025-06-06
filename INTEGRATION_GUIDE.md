# PocketDev Containerized AI Developer Integration Guide

PocketDev supports both **Claude Code** and **OpenAI Codex** agents. See
[`docs/codex-integration.md`](docs/codex-integration.md) for details on using Codex.

## Quick Start

### 1. Install Dependencies

```bash
# Install backend dependencies
cd local-backend
npm install

# Install frontend dependencies  
cd ../web
npm install
```

### 2. Build Docker Image

```bash
# From project root
./scripts/build-docker.sh
```

### 3. Set Environment Variables

Create or update `.env` in `local-backend/`:

```env
# Required
ANTHROPIC_API_KEY=your-api-key-here

# Optional
CLAUDE_MODE=container  # Use 'container' for Docker-based execution
PORT=3001
```

### 4. Start Services

```bash
# Terminal 1: Start backend
cd local-backend
npm run dev

# Terminal 2: Start frontend  
cd web
npm run dev
```

## Testing the Integration

### Option 1: Using the Web UI

1. Open http://localhost:3000
2. Click on a containerized engineer (marked with 🐳)
3. Assign a task with repository details

### Option 2: Using curl

```bash
# 1. Check available containerized engineers
curl http://localhost:3001/api/container/engineers

# 2. Build the Docker image (if not already built)
curl -X POST http://localhost:3001/api/container/build-image

# 3. Assign a test task
curl -X POST http://localhost:3001/api/container/assign-task \
  -H "Content-Type: application/json" \
  -d '{
    "engineerId": "frontend-1",
    "repository": {
      "url": "https://github.com/facebook/react.git",
      "branch": "main"
    },
    "description": "Add a simple Hello World component in the fixtures directory",
    "acceptanceCriteria": [
      "Component renders Hello World text",
      "Component has proper TypeScript types",
      "Includes a basic test"
    ],
    "testFramework": "jest",
    "model": "claude-3-5-sonnet-latest"
  }'
```

## Test with Your Own Repository

Replace the repository details with your own:

```bash
curl -X POST http://localhost:3001/api/container/assign-task \
  -H "Content-Type: application/json" \
  -d '{
    "engineerId": "backend-1",
    "repository": {
      "url": "https://github.com/YOUR_ORG/YOUR_REPO.git",
      "branch": "main",
      "credentials": {
        "username": "YOUR_GITHUB_USERNAME",
        "token": "YOUR_GITHUB_TOKEN"
      }
    },
    "description": "YOUR_TASK_DESCRIPTION",
    "acceptanceCriteria": [
      "Criteria 1",
      "Criteria 2"
    ]
  }'
```

## Monitoring Progress

### Check Engineer Status
```bash
curl http://localhost:3001/api/container/engineers/frontend-1
```

### Get Task Details
```bash
curl http://localhost:3001/api/container/tasks/{TASK_ID}
```

### View Active Containers
```bash
curl http://localhost:3001/api/container/active
```

## Troubleshooting

### Docker Not Found
```bash
# Install Docker
# macOS: brew install docker
# Ubuntu: sudo apt-get install docker.io
# Make sure Docker daemon is running
```

### Permission Denied
```bash
# Add user to docker group
sudo usermod -aG docker $USER
# Log out and back in
```

### API Key Issues
- Ensure ANTHROPIC_API_KEY is set in .env
- Check the key has sufficient credits

### Container Fails
```bash
# Check logs
docker logs $(docker ps -a -q -n 1)

# Clean up stopped containers
docker container prune
```

## Next Steps

1. **Test with a Simple Task**: Start with a basic task on a public repo
2. **Monitor Execution**: Watch the logs to see Claude working
3. **Review Results**: Check the generated PR link
4. **Customize Engineers**: Modify system prompts in container-task-manager.js
5. **Add More Engineers**: Register custom engineers for specific needs

## Architecture Overview

```
Frontend (React) 
    ↓
Backend API (Express)
    ↓
Container Orchestrator
    ↓
Docker Container
    ├── Claude CLI (with session management)
    ├── Git Operations
    ├── Test Frameworks
    └── Development Tools
```

Each task runs in an isolated container with:
- Full Git access
- Claude with persistent sessions
- Test execution capabilities
- Automatic PR creation

The system tracks:
- Task progress
- Session IDs for continuity
- Costs and duration
- Generated files and PRs