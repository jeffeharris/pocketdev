# Containerized AI Developer Usage Guide

## Overview

The containerized AI developer system allows PocketDev to run AI engineers in isolated Docker containers with full development capabilities including Git integration, test-driven development, and automated PR creation.

## Quick Start

### 1. Build the Docker Image

First, build the AI developer Docker image:

```bash
# From the backend directory
curl -X POST http://localhost:3001/api/container/build-image
```

### 2. View Available Engineers

Get list of containerized AI engineers:

```bash
curl http://localhost:3001/api/container/engineers
```

Response:
```json
[
  {
    "id": "frontend-1",
    "name": "Frontend Engineer",
    "role": "frontend",
    "specialties": ["React", "TypeScript", "UI/UX"],
    "status": "idle"
  },
  {
    "id": "backend-1",
    "name": "Backend Engineer",
    "role": "backend",
    "specialties": ["Node.js", "Python", "API Design"],
    "status": "idle"
  }
]
```

### 3. Assign a Containerized Task

```bash
curl -X POST http://localhost:3001/api/container/assign-task \
  -H "Content-Type: application/json" \
  -d '{
    "engineerId": "frontend-1",
    "repository": {
      "url": "https://github.com/your-org/your-repo.git",
      "branch": "main",
      "credentials": {
        "username": "your-github-username",
        "token": "your-github-token"
      }
    },
    "description": "Add a dark mode toggle to the settings page",
    "acceptanceCriteria": [
      "Toggle switch in settings UI",
      "Theme persists across sessions",
      "All components support dark theme",
      "Tests cover theme switching"
    ],
    "testFramework": "jest",
    "model": "claude-3-5-sonnet-latest"
  }'
```

### 4. Monitor Task Progress

Check engineer status:

```bash
curl http://localhost:3001/api/container/engineers/frontend-1
```

Get task details:

```bash
curl http://localhost:3001/api/container/tasks/{taskId}
```

### 5. Continue a Task

If you need to provide additional instructions:

```bash
curl -X POST http://localhost:3001/api/container/continue-task \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "previous-task-id",
    "additionalInstructions": "Also add theme preference to user profile API"
  }'
```

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
  "repository": {
    "url": "string",
    "branch": "string",
    "credentials": {
      "username": "string",
      "token": "string"
    }
  },
  "description": "string",
  "acceptanceCriteria": ["string"],
  "testFramework": "jest|pytest|mocha",
  "model": "claude-3-5-sonnet-latest|opus|sonnet",
  "maxIterations": 5
}
```

#### Get Task Details
```
GET /api/container/tasks/:id
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

#### Get Active Containers
```
GET /api/container/active
```

## Task Workflow

1. **Repository Setup**
   - Container clones the repository
   - Creates a feature branch
   - Analyzes codebase structure

2. **Test-Driven Development**
   - Claude writes tests first
   - Implements code to pass tests
   - Iterates until all tests pass
   - Runs linting and formatting

3. **Code Commit**
   - Stages all changes
   - Creates descriptive commit message
   - Pushes to remote branch

4. **Pull Request Creation**
   - Generates PR description
   - Includes test results
   - Links to related issues

## Environment Variables

Set these in your `.env` file:

```bash
# Required
ANTHROPIC_API_KEY=your-api-key

# Optional
DOCKER_IMAGE=pocketdev/ai-developer:latest
WORKSPACE_BASE=/tmp/pocketdev-workspaces
```

## Examples

### Frontend Feature Development

```javascript
const task = {
  engineerId: "frontend-1",
  repository: {
    url: "https://github.com/acme/web-app.git",
    branch: "main"
  },
  description: "Add user profile page with edit functionality",
  acceptanceCriteria: [
    "Profile displays user information",
    "Edit mode allows updating name, email, bio",
    "Form validation for required fields",
    "Success/error notifications",
    "Mobile responsive design"
  ],
  testFramework: "jest",
  model: "claude-3-5-sonnet-latest"
};
```

### Backend API Development

```javascript
const task = {
  engineerId: "backend-1",
  repository: {
    url: "https://github.com/acme/api-server.git",
    branch: "develop"
  },
  description: "Create REST API endpoints for user preferences",
  acceptanceCriteria: [
    "GET /api/users/:id/preferences",
    "PUT /api/users/:id/preferences", 
    "Proper authentication checks",
    "Input validation",
    "Unit and integration tests"
  ],
  testFramework: "pytest",
  model: "claude-3-5-sonnet-latest"
};
```

### DevOps Configuration

```javascript
const task = {
  engineerId: "devops-1",
  repository: {
    url: "https://github.com/acme/infrastructure.git",
    branch: "main"
  },
  description: "Set up GitHub Actions for automated testing",
  acceptanceCriteria: [
    "Run tests on pull requests",
    "Generate coverage reports",
    "Fail if coverage drops below 80%",
    "Cache dependencies for speed"
  ],
  model: "claude-3-5-sonnet-latest"
};
```

## Best Practices

1. **Clear Task Descriptions**
   - Be specific about what needs to be built
   - Include technical requirements
   - Mention any constraints or preferences

2. **Comprehensive Acceptance Criteria**
   - Define testable requirements
   - Include edge cases
   - Specify performance requirements

3. **Repository Preparation**
   - Ensure CI/CD is configured
   - Have clear contributing guidelines
   - Include example code patterns

4. **Session Management**
   - Use task continuation for complex features
   - Keep sessions focused on single features
   - Review work before creating PRs

## Troubleshooting

### Container Fails to Start
- Check Docker is running: `docker ps`
- Verify image exists: `docker images | grep pocketdev`
- Check logs in workspace directory

### Git Authentication Issues
- Ensure credentials have repository access
- Use personal access tokens, not passwords
- Check token has necessary scopes

### Task Timeouts
- Increase `maxIterations` for complex tasks
- Break large tasks into smaller ones
- Use task continuation feature

### Engineer Stuck in Error State
- Use reset endpoint: `POST /api/container/engineers/:id/reset`
- Check task logs for error details
- Clean up workspace if needed

## Security Considerations

1. **Container Isolation**
   - Each task runs in isolated container
   - No internet access except Git operations
   - Read-only access to main branch

2. **Credentials Management**
   - Never commit credentials
   - Use environment variables
   - Rotate tokens regularly

3. **Resource Limits**
   - CPU: 2 cores per container
   - Memory: 4GB per container
   - Timeout: 30 minutes per task

## Future Enhancements

- Multi-agent collaboration
- Deployment automation
- Performance profiling
- Security scanning
- Custom tool integration via MCP