# PocketDev Architecture

This document describes the current architecture of the PocketDev containerized AI developer system.

## System Overview

PocketDev orchestrates AI developers working in isolated Docker containers to complete programming tasks autonomously. The system provides a web interface for task assignment, real-time monitoring, and result management.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Web Frontend  │────▶│  Local Backend   │────▶│ Docker Engine   │
│  (React + TS)   │◀────│  (Node.js API)   │◀────│  (Containers)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                         │
         │                       │                         ▼
         │                       │                 ┌───────────────┐
         │                       │                 │ AI Developer  │
         │                       │                 │  Container    │
         │                       │                 │   - Clone     │
         │                       │                 │   - Branch    │
         │                       │                 │   - Implement │
         │                       │                 │   - Test      │
         │                       │                 │   - Push      │
         └───────────────────────┴─────────────────┴───────────────┘
                          Real-time Updates
```

## Components

### 1. Web Frontend (`/web`)

**Technology**: React, TypeScript, Vite, Tailwind CSS

**Key Components**:
- `ContainerEngineerCardEnhanced.tsx` - Engineer status cards with real-time polling
- `ContainerTaskModal.tsx` - Task assignment interface
- `TaskResultView.tsx` - Rich result display with accept/follow-up actions
- `TaskHistory.tsx` - Historical task view

**Features**:
- Real-time log streaming (2-second polling)
- Task progress visualization
- Result review and acceptance workflow
- Multiple engineer role selection

### 2. Local Backend (`/local-backend`)

**Technology**: Node.js, Express, ES Modules

**Key Modules**:
- `container-orchestrator.js` - Low-level Docker container management
- `container-task-manager.js` - High-level task orchestration
- `container-routes.js` - REST API endpoints

**API Endpoints**:
```
POST   /api/container/assign-task      - Assign new task
GET    /api/container/tasks/:id        - Get task details
GET    /api/container/tasks/:id/result - Get task results
POST   /api/container/tasks/:id/accept - Accept and commit
POST   /api/container/continue-task    - Follow-up task
GET    /api/container/engineers        - List engineers
```

### 3. Docker Infrastructure (`/docker`)

**AI Developer Container**:
- Base: Ubuntu with Node.js 18
- Tools: Git, Claude CLI, jq, Python
- Entrypoint: `/docker/ai-developer/entrypoint.sh`

**Container Lifecycle**:
1. **Launch**: Container starts with task parameters
2. **Execute**: Clone repo → Create branch → Implement → Test
3. **Wait**: Container stays alive for user decision
4. **Signal**: Receives SHUTDOWN (accept) or CONTINUE (iterate)
5. **Finalize**: Commits and pushes or continues work

### 4. Workspace Management

**Structure**:
```
workspaces/
└── <task-id>/
    ├── repo/               # Cloned repository
    ├── logs/               # Execution logs
    │   └── session_*.log   # Timestamped logs
    └── results/
        ├── session_result.json  # Task results
        ├── SHUTDOWN            # Signal files
        ├── CONTINUE
        └── followup_task.txt
```

## Data Flow

### Task Assignment Flow

```
User Input → Frontend → POST /api/container/assign-task
    ↓
Backend creates task → Launches Docker container
    ↓
Container executes → Writes results to workspace
    ↓
Backend polls results → Updates engineer status
    ↓
Frontend polls status → Shows results to user
```

### Result Handling Flow

```
Task Complete → session_result.json written
    ↓
Backend detects → Updates task status
    ↓
Frontend polls → Displays TaskResultView
    ↓
User decides → Accept or Request Changes
    ↓
Backend signals → SHUTDOWN or CONTINUE
    ↓
Container acts → Commit/Push or Continue
```

## Key Design Decisions

### 1. Polling vs WebSockets
- **Decision**: 2-second polling for updates
- **Rationale**: Simpler implementation, sufficient for UX, easier debugging

### 2. One-Shot Execution
- **Decision**: Single comprehensive Claude prompt instead of TDD iterations
- **Rationale**: Faster execution, lower costs, simpler control flow

### 3. Signal Files
- **Decision**: Use filesystem signals (SHUTDOWN/CONTINUE) for container communication
- **Rationale**: Docker-native, survives restarts, simple to implement

### 4. Workspace Persistence
- **Decision**: Keep workspaces on host filesystem
- **Rationale**: Debugging capability, session continuity, audit trail

### 5. Result JSON Format
```json
{
  "success": true,
  "sessionId": "uuid",
  "summary": "What was accomplished",
  "error": null,
  "duration": 152,
  "cost_usd": 0.10,
  "filesChanged": ["file1.js", "file2.ts"],
  "testResults": "Verification output",
  "suggestedNextSteps": ["Review", "Test", "Deploy"],
  "featureBranch": "ai/frontend/feature-name-1234567890",
  "prUrl": "https://github.com/user/repo/pull/new/branch"
}
```

## Security Model

### Container Isolation
- Each task runs in isolated container
- No shared volumes between containers
- Limited network access (only Git operations)

### Credential Management
- API keys passed via environment variables
- Git credentials never persisted
- No secrets in logs or results

### Resource Limits
- CPU: 2 cores per container
- Memory: 4GB per container  
- Disk: Workspace quota enforcement
- Time: 30-minute timeout

## Performance Characteristics

### Typical Task Timeline
- Container startup: 2-5 seconds
- Repository clone: 5-30 seconds (size dependent)
- Implementation: 60-300 seconds (complexity dependent)
- Result processing: <1 second
- Total: 2-10 minutes average

### Scaling Considerations
- Concurrent tasks: Limited by Docker resources
- Workspace growth: Implement cleanup policies
- API costs: Monitor Claude token usage

## Error Handling

### Container Failures
- Automatic status update to "error"
- Error details in session_result.json
- Engineer reset capability

### Network Issues
- Git operation retries
- API request timeouts
- Graceful degradation

### Resource Exhaustion
- Container limits prevent runaway processes
- Workspace cleanup for disk space
- Task timeouts prevent infinite loops

## Future Enhancements

### Near Term
- WebSocket support for real-time updates
- Multi-agent task coordination
- Enhanced context persistence
- Mobile app development

### Long Term
- Kubernetes orchestration
- Distributed task execution
- Advanced caching strategies
- Custom tool integration via MCP

## Development Guidelines

### Adding New Features
1. Update container entrypoint.sh for new capabilities
2. Add API endpoints in container-routes.js
3. Update frontend components for UI changes
4. Document in usage guide

### Testing Strategy
- Unit tests for orchestrator and task manager
- Integration tests for API endpoints
- Manual testing with real repositories
- Container image testing

### Debugging Tools
- Container logs: `docker logs <container-id>`
- Workspace inspection: Check results/logs
- API testing: Use curl or Postman
- Frontend debugging: React DevTools