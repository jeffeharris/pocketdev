# AI Developer Entrypoint Script Usage

## Overview

The `entrypoint.sh` script handles the complete AI-powered development workflow including:
- Repository cloning and branch management
- Claude CLI session initialization
- Test-driven development (TDD) task execution
- Git operations (commit, push, PR creation)
- Comprehensive logging and result tracking

## Environment Variables

### Required Variables
- `REPO_URL`: Git repository URL to clone
- `TASK_DESCRIPTION`: Detailed description of the development task
- `CLAUDE_API_KEY`: Anthropic API key for Claude CLI

### Optional Variables
- `BRANCH_NAME`: Git branch name (default: "main")
- `TEST_COMMAND`: Command to run tests (default: "npm test")
- `COMMIT_MESSAGE`: Custom commit message (default: "AI Developer: {task description}")
- `CREATE_PR`: Whether to create a pull request (default: "false")
- `PR_TITLE`: Pull request title (default: uses task description)
- `PR_BODY`: Pull request body (default: "Automated PR created by AI Developer")
- `SESSION_ID`: Unique session identifier (default: current timestamp)

## Usage Examples

### Basic Usage
```bash
docker run -e REPO_URL="https://github.com/user/repo.git" \
           -e TASK_DESCRIPTION="Add user authentication with JWT tokens" \
           -e CLAUDE_API_KEY="your-api-key" \
           ai-developer:latest
```

### Advanced Usage with Custom Branch and PR Creation
```bash
docker run -e REPO_URL="https://github.com/user/repo.git" \
           -e BRANCH_NAME="feature/add-auth" \
           -e TASK_DESCRIPTION="Implement user authentication with JWT tokens, including login, logout, and token refresh endpoints" \
           -e CLAUDE_API_KEY="your-api-key" \
           -e TEST_COMMAND="npm run test:unit && npm run test:integration" \
           -e CREATE_PR="true" \
           -e PR_TITLE="Add JWT-based authentication system" \
           -e PR_BODY="This PR implements a complete JWT authentication system with login, logout, and token refresh capabilities." \
           -v $(pwd)/results:/workspace/results \
           -v $(pwd)/logs:/workspace/logs \
           ai-developer:latest
```

### Python Project Example
```bash
docker run -e REPO_URL="https://github.com/user/python-app.git" \
           -e TASK_DESCRIPTION="Add data validation for user input using Pydantic models" \
           -e CLAUDE_API_KEY="your-api-key" \
           -e TEST_COMMAND="pytest -v" \
           ai-developer:latest
```

## Output Structure

### Logs
- Location: `/workspace/logs/session_{SESSION_ID}.log`
- Contains detailed execution logs including Claude interactions

### Results
- Location: `/workspace/results/session_{SESSION_ID}.json`
- JSON structure:
```json
{
  "session_id": "1234567890",
  "start_time": "2024-01-01T12:00:00Z",
  "status": "success|failed|interrupted",
  "repository": "https://github.com/user/repo.git",
  "branch": "feature/branch-name",
  "task": "Task description",
  "steps": [
    {
      "name": "clone_repository",
      "status": "success",
      "timestamp": "2024-01-01T12:00:10Z",
      "details": "Repository cloned"
    }
  ],
  "end_time": "2024-01-01T12:30:00Z"
}
```

## Volume Mounts

For persistent logs and results:
```bash
docker run -v /host/path/logs:/workspace/logs \
           -v /host/path/results:/workspace/results \
           ...
```

## Exit Codes
- `0`: Success
- `1`: General failure
- `130`: Interrupted (SIGINT/SIGTERM)

## TDD Workflow

The script instructs Claude to follow Test-Driven Development:
1. Write failing tests based on requirements
2. Run tests to confirm they fail
3. Implement minimal code to pass tests
4. Run tests to confirm they pass
5. Refactor while keeping tests green
6. Commit atomic changes

## Security Considerations

- The script runs with git config for a generic AI Developer user
- API keys should be passed as environment variables, never hardcoded
- Consider using Docker secrets for sensitive data in production
- Repository access depends on the provided URL (use SSH keys or tokens as needed)

## Limitations

- PR creation is currently a placeholder - implement based on your Git platform (GitHub, GitLab, etc.)
- The script assumes the repository has a test suite configured
- Claude interactions are synchronous and may take time for complex tasks