# PocketDev Unified Platform - TODO & Refactoring Notes

<!-- Document Metadata
Created: 2025-07-01
Modified: 2025-07-11
Status: ????
-->


## Current State (2025-01-07)

### ✅ Completed
1. **Frontend Modernization** - React + TypeScript + Vite setup complete
2. **UI Implementation** - Beautiful task workspace with all components
3. **API Service Layer** - Created with TypeScript types and mock support
4. **Backend Refactoring** - Split 1000+ line controller into focused modules:
   - `TaskController` - Core CRUD operations (552 lines)
   - `TaskGitController` - Git operations and status
   - `TaskPullRequestController` - PR creation and management
   - `TaskContainerController` - Container deployment (placeholder)
5. **Route Consolidation** - Properly integrated all routes into main task.routes.js

### 🚧 In Progress
1. **Testing** - Need to verify frontend works with refactored backend
2. **WebSocket Implementation** - Real-time updates not yet implemented

## Refactoring Needs

### 1. Backend Architecture Issues

#### Duplicate Route Registration
**File**: `simple/server/routes/index.js`
- Task routes are mounted twice on the same path
- Should consolidate `task.routes.js` and `task-extended.routes.js` into one file
- Or mount extended routes on a different sub-path like `/extended`

#### Missing Error Handling
**Files**: All route files
- Need consistent error handling middleware
- Should wrap all async route handlers with try-catch
- Add request validation middleware

#### Git Service Token Management
**File**: `simple/server/services/git.service.js`
- GitHub token is passed around inconsistently
- Should be managed at the service level or through dependency injection
- Need secure token storage solution

### 2. Frontend Issues

#### API Client Organization
**File**: `simple/frontend/src/services/api.ts`
- Single large class is becoming unwieldy
- Should split into domain-specific services (ProjectService, TaskService, GitService)
- Need proper error handling and retry logic

#### Real-time Updates Not Implemented
- WebSocket connections stubbed but not implemented
- Need to implement SSE or WebSocket for:
  - Task progress updates
  - Git file watching
  - Container log streaming

#### Missing Loading States
- Many components don't show loading indicators
- Need global loading state management
- Should add skeleton screens for better UX

### 3. Database Schema Issues

#### Task Model Limitations
**File**: `simple/server/models/tasks.model.js` (assumed)
- No support for task phases (generate/validate/merge)
- Missing fields: engineer assignment, validation state, PR info
- Need migration strategy for schema updates

#### Project-Task Relationships
- No cascade delete for tasks when project is deleted
- Missing indexes for performance
- Need better query optimization

### 4. Container Management

#### Not Implemented
**Files**: `simple/server/routes/task-extended.routes.js`
- Container deployment endpoints return mock data
- Need actual Docker integration
- Missing container lifecycle management
- No resource limits or monitoring

#### Port Management
- No system for allocating ports to containers
- Need port pool management
- Should implement the hybrid nginx/direct port strategy

### 5. Security Concerns

#### CORS Configuration
**File**: `simple/server/app.js`
- CORS allows all origins
- Should restrict to known frontend URLs
- Need environment-specific CORS settings

#### Path Traversal Risks
- File paths from user input not validated
- Need path sanitization in all file operations
- Should restrict operations to project directories

#### Missing Authentication
- No user authentication implemented
- All endpoints are public
- Need auth middleware and session management

## Implementation Priority

### Phase 1: Critical Fixes (Week 1)
1. **Fix route duplication** - Consolidate task routes
2. **Add error handling** - Wrap all async handlers
3. **Implement WebSocket/SSE** - For real-time updates
4. **Add authentication** - Basic auth middleware

### Phase 2: Core Features (Week 2)
1. **Container deployment** - Real Docker integration
2. **Port management** - Implement port allocation
3. **Database migrations** - Update task schema
4. **Split API services** - Refactor frontend services

### Phase 3: Polish (Week 3)
1. **Loading states** - Add throughout UI
2. **Error boundaries** - Better error handling
3. **Performance optimization** - Add caching
4. **Security hardening** - Path validation, CORS

### Phase 4: Advanced Features (Week 4)
1. **DinD implementation** - Full container isolation
2. **Multi-tenancy** - Project/user isolation
3. **Monitoring** - Resource usage tracking
4. **Backup/restore** - Task state persistence

## Technical Debt

### Code Duplication
- Git operations repeated in multiple places
- Similar UI patterns not extracted to components
- API response mapping duplicated

### Missing Tests
- No unit tests for backend services
- No integration tests for API endpoints
- No component tests for React UI
- Need E2E test suite

### Documentation Gaps
- API endpoints not documented
- No setup guide for development
- Missing architecture diagrams
- Need user documentation

## Next Immediate Steps

1. **Test Current Implementation**
   ```bash
   cd simple/frontend && npm run dev
   cd simple/server && npm start
   ```

2. **Fix Route Duplication**
   - Merge task routes into single file
   - Remove duplicate route mounting

3. **Implement One Real Endpoint**
   - Start with git status endpoint
   - Connect frontend to real backend
   - Verify data flow works

4. **Add Basic WebSocket**
   - Implement task progress updates
   - Test real-time communication
   - Add reconnection logic

## Notes for Future Development

### Container Strategy Decision Needed
- Current mock implementation assumes direct Docker
- Need to decide: Docker-in-Docker vs. Kubernetes vs. Docker API
- Consider security implications of each approach

### State Management
- Currently using local React state
- May need Redux/Zustand for complex state
- Consider state persistence strategy

### Deployment Considerations
- How to package frontend + backend
- Docker compose setup needed
- Environment variable management
- SSL/TLS configuration

### Monitoring & Observability
- Add structured logging
- Implement health checks
- Add performance metrics
- Consider APM integration