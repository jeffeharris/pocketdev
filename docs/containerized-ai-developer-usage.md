# Containerized AI Developer Usage Guide

This guide explains how to use the containerized AI developers in PocketDev, including task assignment, monitoring, and result management.

## Overview

PocketDev's containerized AI developers work autonomously in isolated Docker environments to complete programming tasks. Each AI developer:

- Runs in its own Docker container with a complete development environment
- Has access to Claude for code generation and problem-solving
- Creates feature branches automatically
- Writes verification scripts to test their implementations
- Can be monitored in real-time through log streaming

## Quick Start

### 1. Start the System

```bash
# Development mode (recommended)
./scripts/dev-docker.sh

# Production mode
docker-compose up
```

Access the web interface at http://localhost:5173 (dev) or http://localhost:3001 (prod).

### 2. Assign a Task

1. Click on an available engineer card (Frontend, Backend, or DevOps)
2. Fill in the task form:
   - **Repository URL**: GitHub repository (e.g., `https://github.com/user/repo.git`)
   - **Task Description**: Clear description of what needs to be done
   - **Git Username**: Your GitHub username
   - **Git Token**: GitHub personal access token with repo permissions
3. Click "Assign Task"

### 3. Monitor Progress

Once assigned, you'll see:
- **Real-time logs**: Live output from the AI developer
- **Status indicators**: 
  - 😴 Idle
  - 🤔 Thinking
  - 💻 Working
  - ✅ Completed
  - ❌ Failed
- **Progress updates**: Files being modified, tests being run

### 4. Review Results

When the task completes, you'll see:
- **Summary**: What was accomplished
- **Files Changed**: List of modified files
- **Test Results**: Output from verification scripts
- **Cost & Duration**: API usage and time taken
- **Suggested Next Steps**: AI's recommendations

### 5. Accept or Iterate

Two options are available:
- **Accept & Commit**: Commits changes and pushes to GitHub
- **Request Changes**: Provide feedback for the AI to make adjustments

## Task Execution Flow

### Phase 1: Setup
1. Container launches with task parameters
2. Repository is cloned
3. Feature branch is created (e.g., `ai/frontend/add-dark-mode-1234567890`)

### Phase 2: Implementation
1. AI analyzes the codebase
2. Creates a verification script (verify.js, test.py, etc.)
3. Implements the requested feature
4. Runs the verification script
5. Fixes any issues until tests pass

### Phase 3: Results
1. Changes are staged (not committed)
2. Results JSON is generated with all details
3. Container waits for user decision

### Phase 4: Finalization
- **If Accepted**: Changes are committed and pushed to the feature branch
- **If Changes Requested**: AI makes adjustments based on feedback

## API Reference

### Container Management

#### Build Docker Image
```
POST /api/container/build-image
```

#### Cleanup Old Workspaces
```
POST /api/container/cleanup
Body: { "olderThanHours": 24 }
```

### Engineer Management

#### List All Engineers
```
GET /api/container/engineers
```

#### Get Engineer Status
```
GET /api/container/engineers/:id
```

#### Get Engineer Task History
```
GET /api/container/engineers/:id/history
```

#### Reset Engineer (from error state)
```
POST /api/container/engineers/:id/reset
```

### Task Management

#### Assign Task
```
POST /api/container/assign-task
Body: {
  "engineerId": "string",
  "repository": "https://github.com/user/repo.git",
  "description": "string",
  "acceptanceCriteria": ["string"],
  "testFramework": "jest|pytest|mocha",
  "model": "claude-3-5-sonnet-latest",
  "maxIterations": 5
}
```

#### Get Task Details
```
GET /api/container/tasks/:id
```

#### Get Task Result
```
GET /api/container/tasks/:id/result
```

#### Accept Task and Commit
```
POST /api/container/tasks/:id/accept
```

#### Continue Task
```
POST /api/container/continue-task
Body: {
  "taskId": "string",
  "additionalInstructions": "string"
}
```

#### Stop Running Task
```
POST /api/container/tasks/:id/stop
```

## Best Practices

### Writing Good Task Descriptions

**Do:**
```
Add a dark mode toggle to the settings page that:
- Persists user preference in localStorage
- Applies theme immediately without page reload
- Uses CSS variables for easy theming
```

**Don't:**
```
Add dark mode
```

### Providing Context

Include relevant details:
- Specific files or components to modify
- Existing patterns to follow
- Dependencies or constraints
- Expected behavior

### Git Authentication

For private repositories:
1. Create a GitHub Personal Access Token with `repo` scope
2. Enter your GitHub username and token in the task form
3. The AI will use these credentials to push changes

## Engineer Specializations

### Frontend Engineer
- Specializes in React, TypeScript, and UI/UX
- Focuses on components, accessibility, and user experience
- Best for: UI features, component creation, styling

### Backend Engineer
- Specializes in APIs, databases, and server architecture
- Focuses on security, performance, and error handling
- Best for: API endpoints, data models, business logic

### DevOps Engineer
- Specializes in automation, CI/CD, and infrastructure
- Focuses on deployment, monitoring, and configuration
- Best for: Docker configs, GitHub Actions, deployment scripts

## Examples

### Frontend Feature Development

```javascript
const task = {
  engineerId: "container-frontend",
  repository: "https://github.com/acme/web-app.git",
  description: "Add user profile page with edit functionality",
  acceptanceCriteria: [
    "Profile displays user information",
    "Edit mode allows updating name, email, bio",
    "Form validation for required fields",
    "Success/error notifications",
    "Mobile responsive design"
  ]
};
```

### Backend API Development

```javascript
const task = {
  engineerId: "container-backend",
  repository: "https://github.com/acme/api-server.git",
  description: "Create REST API endpoints for user preferences",
  acceptanceCriteria: [
    "GET /api/users/:id/preferences",
    "PUT /api/users/:id/preferences", 
    "Proper authentication checks",
    "Input validation",
    "Unit and integration tests"
  ]
};
```

### DevOps Configuration

```javascript
const task = {
  engineerId: "container-devops",
  repository: "https://github.com/acme/infrastructure.git",
  description: "Set up GitHub Actions for automated testing",
  acceptanceCriteria: [
    "Run tests on pull requests",
    "Generate coverage reports",
    "Fail if coverage drops below 80%",
    "Cache dependencies for speed"
  ]
};
```

## Monitoring and Debugging

### View Logs
Real-time logs show:
- Claude's thought process
- Commands being executed
- File modifications
- Test results

### Check Workspaces
Workspaces are preserved at:
```
workspaces/<task-id>/
├── repo/          # Cloned repository
├── logs/          # Session logs
└── results/       # Task results
```

### Common Issues

**Task Fails to Start:**
- Check Docker is running
- Verify API key is set in .env
- Ensure repository URL is accessible

**Tests Don't Pass:**
- Review the AI's verification script
- Check if acceptance criteria were clear
- Use "Request Changes" to provide clarification

**Can't Push to GitHub:**
- Verify Git credentials are correct
- Check token has necessary permissions
- Ensure branch protection rules allow pushes

## Advanced Usage

### Continuing Tasks

To build upon previous work:
1. Use "Request Changes" on a completed task
2. Provide additional instructions
3. AI will continue in the same context

### Parallel Tasks

You can assign tasks to multiple engineers simultaneously:
- Each runs in its own container
- No interference between tasks
- Monitor all progress in real-time

### Custom Models

Specify different Claude models:
- `claude-3-5-sonnet-latest` (default)
- `claude-3-opus-latest` (more capable)
- `claude-3-haiku-latest` (faster, cheaper)

## Cost Management

Each task shows:
- Token usage
- Estimated cost in USD
- Duration

Tips to reduce costs:
- Be specific in task descriptions
- Break large tasks into smaller ones
- Use appropriate models for task complexity

## Security Considerations

- Containers are isolated from each other
- No access to host filesystem outside workspaces
- Git credentials are passed securely via environment variables
- API keys are never logged or exposed
- Each container has resource limits:
  - CPU: 2 cores
  - Memory: 4GB
  - Timeout: 30 minutes

## Troubleshooting

### Container Won't Start
```bash
# Check Docker status
docker ps -a

# View container logs
docker logs <container-id>

# Rebuild images
./scripts/build-docker.sh
```

### Task Stuck
```bash
# Stop the task via API
curl -X POST http://localhost:5001/api/container/tasks/<task-id>/stop

# Or reset the engineer
curl -X POST http://localhost:5001/api/container/engineers/<engineer-id>/reset
```

### Cleanup Old Workspaces
```bash
# Remove workspaces older than 24 hours
curl -X POST http://localhost:5001/api/container/cleanup \
  -H "Content-Type: application/json" \
  -d '{"olderThanHours": 24}'
```

## Next Steps

- Review the [Architecture Documentation](./containerized-ai-developer-plan.md)
- Check the [Integration Guide](./containerized-claude-integration.md)
- Explore example projects in the `/examples` directory