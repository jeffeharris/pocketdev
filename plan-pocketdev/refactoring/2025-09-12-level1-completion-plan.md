# Level 1 Service Extraction Completion Plan

<!-- Document Metadata
Created: 2025-09-13
Modified: 2025-09-13
Status: active
-->

**Date Created**: 2025-09-12  
**Status**: In Progress

## Current State Assessment

### What Was Attempted
- Reduced `task.controller.js` from 907 → 496 lines
- Reduced `project.controller.js` from 654 → 430 lines
- Created/enhanced TaskService and ProjectService
- Moved some business logic from controllers to services

### Why It's Incomplete
Based on Ousterhout's deep module analysis:
1. **Controllers still contain business logic** (not thin HTTP adapters)
2. **Services are shallow modules** with 15-17+ public methods (should be ~8)
3. **Git services are fragmented** across 7 different modules
4. **Duplicate code exists** in ProjectService and between layers
5. **Services create their own dependencies** instead of dependency injection

## Critical Blockers to Level 1 Completion

### 1. Controller Business Logic That Must Move

#### task.controller.js
- **Lines 433-487**: `_checkMergeStatus()` method (54 lines)
  - Direct git service usage
  - Complex merge analysis logic
  - Database state updates
  - **Action**: Move entirely to TaskService

- **Lines 225-308**: Split layout management (83 lines)
  - Validation logic
  - Business rules
  - Direct model manipulation
  - **Action**: Extract to new SplitLayoutService

- **Lines 26-44**: Session aggregation logic
  - **Action**: Move to TaskService.getTaskWithSessionState()

#### project.controller.js
- Review remaining methods for any business logic
- Ensure all methods are pure HTTP adapters

### 2. Git Service Consolidation

#### Current Problem: 7 Shallow Git Modules
```
GitExecutor (base)
├── GitRepository (extends GitExecutor)
├── GitWorkingTree (extends GitExecutor)  
├── GitAnalyzer (extends GitExecutor)
GitStatusService (uses other git services)
GitOperationService
GitHubService (GitHub API)
```

#### Target: 2 Deep Modules
```
GitService (ALL git operations)
├── 8-10 public methods maximum
├── Hides all git complexity
├── Single point of configuration
└── Internal use of existing modules

GitHubService (GitHub API only)
└── Keep separate for API operations
```

#### New GitService Interface
```javascript
class GitService {
  // Core Operations (8 methods total)
  async clone(url, destination, options)
  async fetch(repoPath, options) 
  async sync(worktreePath, branch, options)
  async commit(worktreePath, message, files)
  async push(worktreePath, branch, options)
  async getStatus(worktreePath)
  async checkConflicts(worktreePath, targetBranch)
  async merge(worktreePath, sourceBranch, options)
}
```

### 3. Service Interface Simplification

#### TaskService (Target: 8 methods)
Current: 15+ methods → Reduce to:
```javascript
class TaskService {
  async createTask(projectId, taskData, githubToken)
  async deleteTask(taskId, options)
  async updateTask(taskId, updates)
  async getTask(taskId)
  async listTasks(projectId, filters)
  async mergeTask(taskId, options)
  async getTaskStatus(taskId)
  async checkMergeConflicts(taskId)
}
```

#### ProjectService (Target: 8 methods)
Current: 17+ methods → Reduce to:
```javascript
class ProjectService {
  async createProject(projectData)
  async deleteProject(projectId)
  async updateProject(projectId, updates)
  async getProject(projectId)
  async listProjects(filters)
  async syncProject(projectId)
  async getProjectBranches(projectId)
  async getProjectDashboard(projectId)
}
```

### 4. Duplicate Code Removal

#### ProjectService Duplicates
- **Lines 457-521 & 998-1062**: `_createDefaultPlanningDocument()` 
  - **Action**: Remove duplicate at lines 998-1062
  
- **Lines 527-555 & 1068-1096**: `_createPlanningViaGitHubAPI()`
  - **Action**: Remove duplicate at lines 1068-1096

## Implementation Steps

### Phase 1: Complete Controller Extraction (Immediate)
1. [ ] Move `_checkMergeStatus()` from task.controller to TaskService
2. [ ] Create SplitLayoutService and move split layout logic
3. [ ] Move session aggregation from task.controller to TaskService
4. [ ] Remove ALL git-related imports from controllers
5. [ ] Verify controllers are pure HTTP adapters (input → service → response)

### Phase 2: Git Service Consolidation (High Priority)
1. [ ] Create new unified GitService class
2. [ ] Implement 8 core methods using existing git modules internally
3. [ ] Update ServiceInitializer to create single GitService instance
4. [ ] Update TaskService to use GitService instead of creating git modules
5. [ ] Update ProjectService to use GitService
6. [ ] Delete GitStatusService and GitOperationService
7. [ ] Keep GitRepository, GitWorkingTree, GitAnalyzer as internal implementations

### Phase 3: Service Simplification (High Priority)
1. [ ] Audit TaskService public methods
2. [ ] Consolidate/remove methods to reach 8-method target
3. [ ] Audit ProjectService public methods  
4. [ ] Consolidate/remove methods to reach 8-method target
5. [ ] Move complex aggregations to dedicated query services if needed

### Phase 4: Clean Up (Medium Priority)
1. [ ] Remove duplicate methods in ProjectService
2. [ ] Standardize error handling patterns
3. [ ] Remove all `new` operators from service methods
4. [ ] Ensure proper dependency injection throughout

## Success Criteria

### Controllers (Thin HTTP Adapters)
- [ ] No business logic in controllers
- [ ] No direct model access
- [ ] No git service imports
- [ ] Methods are 10-20 lines maximum
- [ ] Only responsibilities: validate input, call service, format response

### Services (Deep Modules)
- [ ] 8-10 public methods maximum per service
- [ ] Simple interfaces hiding complex implementations
- [ ] No instantiation of dependencies (receive via constructor)
- [ ] Clear single responsibility
- [ ] No duplicate code

### Git Architecture
- [ ] Single GitService with 8-10 methods
- [ ] No git modules instantiated outside of GitService
- [ ] GitHubService separate for API operations
- [ ] No raw git commands in services

## Validation Checklist

After implementation, verify:
- [ ] `wc -l controllers/*.js` shows further reduction
- [ ] `grep -r "new Git" services/` returns only results in GitService
- [ ] `grep -r "gitService\." services/` shows services using injected GitService
- [ ] Controllers have no methods over 20 lines
- [ ] Services have no more than 10 public methods each

## Notes

This is a hobby project - we're optimizing for:
- **Simplicity** over flexibility
- **Clear code** over enterprise patterns  
- **Fewer files** over micro-services
- **Deep modules** over many shallow ones

The goal is to make the codebase easier to understand and maintain, not to create an enterprise-grade architecture.

## Agans Implementation Risk Review

### 1. Understanding the System

**Current State Analysis:**
- TaskService has 12 public methods + 3 private (15 total) - exceeds target by 50%
- ProjectService has 18 public methods - exceeds target by 125%
- TaskController still contains 54 lines of complex git merge logic (`_checkMergeStatus`)
- Split layout management spans 83 lines in controller (lines 225-308)
- Multiple git service instantiations throughout both services

**Key Finding:** The services are creating their own dependencies (`new GitRepository()`, `new GitWorkingTree()`, etc.) instead of receiving them via dependency injection, making it impossible to mock for testing.

### 2. Making It Fail - Potential Failure Points

**Phase 1 Risks (Controller Extraction):**
- **Hidden Dependency:** `_checkMergeStatus` directly manipulates database state (lines 467-470) - moving it requires passing models to service
- **Event Emission:** Split layout changes emit events through `req.services.EventEmitterService` - moving this requires event service access
- **Session Aggregation:** Lines 26-44 perform complex joins - moving this might break existing API contracts

**Hypothesis:** The biggest risk is breaking event emission when moving logic to services.
**Test:** After moving logic, verify WebSocket events still fire by monitoring browser DevTools Network tab.

### 3. Quit Thinking and Look - Evidence of Problems

**Actual Code Evidence:**
```javascript
// task.service.js line 28 - Creating dependency internally
this.worktreeService = new WorktreeService();

// task.controller.js line 455 - Creating git service in controller
const analyzer = new GitAnalyzer(null);

// project.service.js has duplicate methods (confirmed in plan):
// Lines 457-521 & 998-1062: _createDefaultPlanningDocument()
```

**Test to Verify Duplicates:**
```bash
grep -n "_createDefaultPlanningDocument" backend/services/project.service.js
# Should show 2 occurrences if duplicates exist
```

### 4. Divide and Conquer - Testing Strategy

**Phase 1 Testing (Controller Extraction):**
1. **Before Moving:** Capture current behavior
   - Create a task and record the exact API response
   - Monitor WebSocket events during task creation
   - Check git status updates trigger correctly
   
2. **After Moving Each Method:**
   - Compare API responses byte-for-byte
   - Verify WebSocket events still emit
   - Check database state matches expected

**Phase 2 Testing (Git Consolidation):**
1. **Create Test Harness:** 
   - List all git operations currently working
   - Create a script that exercises each operation
   
2. **After Consolidation:**
   - Run same script, verify identical git outcomes
   - Check performance hasn't degraded (time operations)

### 5. Change One Thing at a Time - Implementation Order

**Critical Order to Maintain:**
1. Move `_checkMergeStatus` FIRST (isolated, testable)
2. Create SplitLayoutService SECOND (new service, no conflicts)
3. Move session aggregation THIRD (might affect API)
4. ONLY THEN consolidate git services

**Why This Order:** Each step is independently testable and rollback-able.

### 6. Keep an Audit Trail - Validation Commands

```bash
# Before starting - capture baseline
echo "=== BASELINE ===" > refactor-audit.log
grep -c "new Git" backend/controllers/*.js >> refactor-audit.log
grep -c "async " backend/services/task.service.js >> refactor-audit.log
wc -l backend/controllers/task.controller.js >> refactor-audit.log

# After each phase - verify progress
echo "=== PHASE X ===" >> refactor-audit.log
# Repeat above commands
```

### 7. Check the Plug - Basic Assumptions to Verify

**Before Starting:**
- [ ] All tests currently pass: `cd backend && npm test`
- [ ] No uncommitted changes: `git status`
- [ ] Database is backed up: `make db-backup`
- [ ] Can create/delete tasks successfully in UI

**Potential "Unplugged" Issues:**
- ServiceInitializer might not be wiring services correctly
- Circular dependencies between services (TaskService → GitService → TaskService)
- Missing environment variables for service configuration

### 8. Get a Fresh View - Alternative Approaches

**Question:** Why not create a facade pattern instead of deep modules?
**Answer:** Would add another layer without reducing complexity.

**Question:** Could we use event sourcing for git operations?
**Answer:** Over-engineering for a hobby project.

**Better Alternative Found:** Instead of 8 methods per service, consider:
- TaskService: 5 core CRUD methods + 1 merge method = 6 total
- ProjectService: 5 core CRUD methods + 1 sync method = 6 total
- Move all "get status" operations to dedicated StatusService

### 9. If You Didn't Fix It, It Ain't Fixed

**Success Validation Checklist:**
- [ ] Can create task with terminal session
- [ ] Can delete task and cleanup worktree
- [ ] Can merge task to base branch
- [ ] Split layout persists across refreshes
- [ ] WebSocket events fire for all operations
- [ ] Git credentials properly configured
- [ ] No "new" operators in service methods
- [ ] Controller methods under 20 lines each
- [ ] Service methods count ≤ 8 public

**Regression Tests:**
```bash
# Quick smoke test after refactoring
curl -X POST localhost:3005/api/projects/PROJECT_ID/tasks \
  -H "Content-Type: application/json" \
  -d '{"name":"test","branch":"test-branch"}'
  
# Should return task with session info
# Check browser console for WebSocket events
```

### Risk Assessment Summary

**Highest Risk:** Phase 2 (Git Consolidation)
- **Why:** Touches every git operation in the system
- **Mitigation:** Create comprehensive git operation test suite first
- **Rollback Plan:** Git consolidation is independent - can be deferred

**Most Complex:** Moving `_checkMergeStatus`
- **Why:** Crosses multiple boundaries (git, database, models)
- **Mitigation:** Move as complete unit with all dependencies
- **Validation:** Test merge conflict detection specifically

**Most Likely to Break:** Event emission during controller extraction
- **Why:** Events wired through request middleware
- **Mitigation:** Pass EventEmitterService to service methods
- **Detection:** Monitor browser DevTools for missing events

**Intermittent Issue Risk:** Session state aggregation
- **Why:** Timing-dependent with Shelltender
- **Mitigation:** Add retry logic if session not immediately available
- **Detection:** Load test with rapid task creation/deletion

## Ousterhout Design Review

### DESIGN ANALYSIS SUMMARY
This plan correctly identifies the core problem: the codebase is riddled with shallow modules that expose too much complexity. The proposed consolidation from 7 git modules to 1 GitService and the 8-method target for services directly addresses Ousterhout's deep module principle. The plan demonstrates good understanding of complexity reduction but needs refinement in execution details.

### CRITICAL ISSUES

**1. GitService Interface Still Too Complex**
- **Principle violated**: Define errors out of existence
- **Problem**: The proposed 8-method GitService interface includes both `checkConflicts()` and `merge()` as separate operations
- **Impact**: Forces callers to handle the error-prone pattern of check-then-act
- **Recommended fix**: Combine into single `safeMerge()` that internally checks conflicts and only proceeds if safe, eliminating an entire class of errors

**2. Missing Abstraction Layer for Split Layouts**
- **Principle violated**: Different layer, different abstraction
- **Problem**: Creating SplitLayoutService for 83 lines of UI state management mixes UI concerns with business logic layer
- **Impact**: Creates a shallow module for what should be client-side state
- **Recommended fix**: Move split layout logic to frontend state management or fold into TaskService as simple configuration data

### HIGH PRIORITY IMPROVEMENTS

**1. Service Method Count Target Too Rigid**
- **Principle violated**: Complexity is the enemy (but also pragmatism)
- **Problem**: Forcing exactly 8 methods may create artificially complex methods that do too much
- **Impact**: Trading interface simplicity for implementation complexity
- **Recommended fix**: Target 5-10 methods based on natural boundaries. TaskService might need 6, ProjectService might need 9 - let the domain guide you

**2. Git Module Consolidation Approach**
- **Principle violated**: Information hiding
- **Problem**: Plan suggests keeping GitRepository, GitWorkingTree, GitAnalyzer as "internal implementations"
- **Impact**: Maintains unnecessary internal complexity
- **Recommended fix**: Fully absorb these modules into GitService as private methods. Don't keep separate classes internally - that's fake modularity

**3. Controller Extraction Incompleteness**
- **Principle violated**: Pull complexity downward
- **Problem**: Moving `_checkMergeStatus()` to TaskService but not questioning why it exists
- **Impact**: Perpetuates complex merge checking pattern
- **Recommended fix**: Redesign the merge flow to eliminate status checking as a separate concern

### MEDIUM PRIORITY SUGGESTIONS

**1. Service Interface Design**
- **Current approach**: Lists CRUD + domain operations
- **Better approach**: Think in terms of user workflows:
  ```javascript
  class TaskService {
    // Lifecycle (3 methods)
    async create(projectId, config)
    async complete(taskId, mergeStrategy) 
    async abandon(taskId)
    
    // Query (2 methods)
    async get(taskId)
    async list(projectId, filter)
    
    // Development (2 methods)
    async sync(taskId)
    async validateMerge(taskId)
  }
  ```

**2. Duplicate Code Strategy**
- **Good**: Identifies specific duplicate methods to remove
- **Missing**: No plan to prevent future duplication
- **Suggestion**: After removing duplicates, add a simple duplication check to your build process

### POSITIVE OBSERVATIONS

**1. Correct Problem Identification**
- Accurately identifies the shallow module pandemic
- Recognizes that 15-17 methods per service is too many
- Understands that controllers shouldn't contain business logic

**2. Git Service Consolidation Vision**
- Consolidating 7 modules into 1 is exactly right
- Hiding git complexity behind simple operations follows deep module principle
- Keeping GitHubService separate shows good boundary recognition

**3. Pragmatic Approach**
- "This is a hobby project" mindset prevents over-engineering
- Focus on simplicity over flexibility is correct
- Success criteria are measurable and specific

### REFACTORING ROADMAP

**Modified Implementation Order**:

1. **Phase 0: Rethink Interfaces** (Before Phase 1)
   - Design TaskService and ProjectService interfaces based on workflows, not CRUD
   - Question every method: "Does this expose complexity or hide it?"
   - Aim for 5-7 methods that cover 90% of use cases

2. **Phase 1: Controller Extraction** (As planned, but enhanced)
   - Don't just move `_checkMergeStatus()` - eliminate it through better design
   - Skip SplitLayoutService - put in TaskService or frontend
   - Make controllers true thin adapters: 10 lines per method maximum

3. **Phase 2: Git Service Deep Module** (Modified approach)
   - Create GitService with 5-6 methods maximum:
     ```javascript
     class GitService {
       async clone(url, path)
       async sync(path, branch) // Combines fetch + merge
       async commit(path, message, files)
       async push(path)
       async getChanges(path) // Combines status + diff
       async safeMerge(path, branch) // Handles conflicts internally
     }
     ```
   - Completely absorb other git modules - no internal class hierarchy
   - Each method should hide 50-100+ lines of complexity

4. **Phase 3: Service Simplification** (More aggressive)
   - Don't just count methods - measure cognitive load
   - Combine related operations (e.g., create + initialize)
   - Push edge cases down into the implementation

### KEY INSIGHTS

The plan is 80% correct but needs more courage in simplification:

1. **Be more aggressive**: Don't target 8 methods - target 5 and accept 8 if necessary
2. **Question everything**: Why does merge checking exist as a separate step?
3. **Think workflows, not operations**: Users don't "check conflicts" - they "complete tasks"
4. **Embrace deletion**: Those 7 git modules shouldn't become internal classes - they should disappear
5. **Design it twice**: For each service, sketch two different interfaces and pick the simpler one

The plan will succeed if you remember Ousterhout's key insight: **The most important resource is developer cognitive capacity**. Every method, every parameter, every possible error state consumes that resource. Guard it jealously.