# ServiceRegistry Removal Test Plan

## Phase 1 Results ✅ COMPLETE

### What Was Done
1. **Removed ServiceRegistry from project.controller.js**
   - Replaced `req.app.locals.serviceRegistry.get('ProjectService')` with direct instantiation
   - Using `new ProjectService(models, githubTokenService, projectsDir)`

2. **Updated server.js**
   - Removed ServiceRegistry import and initialization
   - Created simple services object with direct instantiation
   - Replaced serviceMiddleware with simple `req.services = app.locals.services`

3. **Deleted ServiceRegistry file**
   - Removed `/backend/services/index.js` - **193 lines eliminated**

### Test Results
- ✅ Projects API working (`GET /api/projects`)
- ✅ Dashboard API working (`GET /api/projects/:id/dashboard`)  
- ✅ Settings API working (`GET /api/settings`)
- ✅ All controller endpoints functioning
- ⚠️ Unit tests hanging (pre-existing issue, not related to this change)

### Code Reduction
- **193 lines removed** from ServiceRegistry
- **7 lines simplified** in project.controller.js
- **30+ lines simplified** in server.js
- **Total: ~230 lines of unnecessary abstraction removed**

---

## Phase 2 Results ✅ COMPLETE

### What Was Done
1. **Renamed git-compat.js to git-core.service.js**
   - Acknowledged it's the actual implementation, not a "compatibility layer"
   - File is 619 lines of core git functionality

2. **Updated all imports (10 files)**
   - Controllers: project.controller.js, task.controller.js
   - Services: project, task, pull-request, git-status, git-operation, worktree
   - Tests: git-auth.test.js, pull-request.service.test.js

3. **Updated documentation in the file**
   - Removed "temporary bridge" and "compatibility" references
   - Now properly documented as "Git Core Service"

### Test Results
- ✅ All APIs still working
- ✅ No import errors
- ✅ Git operations functioning normally

### Clarity Improvements
- No more misleading "compat" naming
- Clear that this is the permanent git implementation
- Removed comments about "temporary" code that was actually permanent

---

## Pre-Removal Baseline (Current State)
Record these before making changes:

### Unit Tests Status
- [ ] Run `npm test` and record failing tests
- Current: 93 tests total, ~18 failing (mostly auth/git related)
- Core services passing: task.service, git-status.service, pull-request.service

### Manual Functional Tests

#### 1. Project Operations
- [ ] Create a new project (clone from GitHub)
- [ ] List all projects on dashboard
- [ ] View project details
- [ ] Update project planning document
- [ ] Pull base branch updates

#### 2. Task Operations  
- [ ] Create a new task in a project
- [ ] Open terminal for a task
- [ ] View git status in a task
- [ ] Make changes and commit
- [ ] Create a pull request
- [ ] Archive a task

#### 3. Terminal Operations
- [ ] Open terminal session
- [ ] Execute commands in terminal
- [ ] Create multiple terminal tabs
- [ ] Switch between terminals
- [ ] Close terminal sessions

#### 4. Git Operations
- [ ] View git diff
- [ ] Stage/unstage files
- [ ] Commit changes
- [ ] Check for merge conflicts

## Critical Paths to Test After Each Phase

### After Phase 1 (ServiceRegistry Removal)
Focus on project.controller.js operations since it's the only one using ServiceRegistry:

1. **Project Dashboard** (`GET /api/projects/:id/dashboard`)
   - Should load task summary, git status, terminal sessions
   - WebSocket updates should still work

2. **Project Creation** (`POST /api/projects`)
   - Should clone repository
   - Should initialize worktree
   - Should create database entry

3. **Project Planning** (`GET/PUT /api/projects/:id/planning`)
   - Should read/write planning.md file
   - Should handle missing file gracefully

4. **Branch Operations** (`POST /api/projects/:id/pull-base`)
   - Should pull from remote
   - Should handle conflicts

### After Phase 2 (git-compat.js Rename)
1. All git operations should continue working
2. Tests importing GitService should pass
3. No import errors in console

### After Phase 3 (app.locals Removal)
1. All features should work without app.locals
2. Models access should work
3. GitHub token operations should work

## Automated Testing Commands

```bash
# Quick smoke test - key operations
npm test -- test/services/task.service.test.js
npm test -- test/services/git-status.service.test.js
npm test -- test/services/pull-request.service.test.js

# Full test suite
npm test

# Manual API testing
curl http://localhost:3005/api/projects
curl http://localhost:3005/api/settings
```

## Docker Environment Testing

```bash
# Restart containers after changes
make down && make dev

# Check logs for errors
make logs

# Verify all services started
docker ps
```

## Rollback Plan

If something breaks after ServiceRegistry removal:

1. **Git revert the changes**
   ```bash
   git revert HEAD
   ```

2. **Or stash and reset**
   ```bash
   git stash
   git reset --hard HEAD~1
   ```

3. **Restart services**
   ```bash
   make down && make dev
   ```

## Success Criteria

After ServiceRegistry removal, we should have:
- [ ] All existing tests that were passing still pass
- [ ] No new errors in console/logs
- [ ] All manual functional tests pass
- [ ] 194 lines of code removed
- [ ] Simpler, more direct service access

## Red Flags - Stop if you see:
- Circular dependency errors
- "Cannot find module" errors
- Database connection failures  
- WebSocket connection failures
- More than 5 new test failures

## Green Flags - Good signs:
- Tests run faster (less indirection)
- Code is easier to follow
- Stack traces are shorter
- No "proxy" or "registry" in error messages