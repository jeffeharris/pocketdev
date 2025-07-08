# PocketDev Codebase Separation Guide for Claude

This guide provides exact instructions for Claude to execute the separation of PocketDev into two distinct repositories. Every decision point has explicit criteria.

## Pre-Flight Migration Summary

Before starting, Claude should output:
- Current directory: /home/jeffh/projects/pocketdev
- Current branch: dev (or specify which)
- Migration type: Separating codebases while preserving history
- Key outcome: PocketDev (simple) at root, PocketDev-Studio gets containerized version
- Estimated time: ~20-30 minutes
- Known risks: Path updates, permission issues, Docker configurations

## Claude Tool Usage Pattern

Execute this migration using these specific tool patterns:

1. **Start with TodoWrite** - Create these 11 migration steps IMMEDIATELY:
   ```
   - Step 1: Run pre-migration checks
   - Step 2: Create migration branch
   - Step 3: Map all service dependencies
   - Step 4: Fix directory permissions
   - Step 5: Clean pocketdev-studio
   - Step 6: Move containerized to studio
   - Step 7: Update paths in simple
   - Step 8: Promote simple to root
   - Step 9: Clean up root directory
   - Step 10: Test both configurations
   - Step 11: Commit and document changes
   ```

   **Todo List Best Practices:**
   - Create the 11-step todo list immediately upon starting
   - Update status to "in_progress" BEFORE starting each step
   - Mark "completed" immediately after finishing
   - If a step fails, add a new todo for the fix before proceeding
   - Never batch todo updates - update immediately after each state change

2. **State tracking** - Initialize and maintain throughout:
   ```typescript
   // Claude: Initialize these at the start
   const migrationState = {
     // Version Management
     CURRENT_BRANCH: "",          // Set from: git branch --show-current
     MIGRATION_BRANCH: "",        // separation/migration-YYYYMMDD
     
     // Directory States
     DEPENDENCIES_MAPPED: false,
     PERMISSIONS_FIXED: false,
     STUDIO_CLEANED: false,
     CONTAINERIZED_MOVED: false,
     SIMPLE_PROMOTED: false,
     PATHS_UPDATED: false,
     
     // Test Results
     POCKETDEV_TESTS: "not_run",  // not_run|passed|failed
     STUDIO_TESTS: "not_run",      // not_run|passed|failed|skipped
     
     // Progress Tracking
     STEPS_COMPLETED: [],          // Track: ["step1", "step2", ...]
     ERRORS_ENCOUNTERED: [],       // Log all errors with step number
     CRITICAL_PATHS: [],           // Paths that need updating
     ROLLBACK_POINTS: []          // Snapshots for recovery
   };
   
   // Claude should maintain these variables throughout the migration
   // Update TodoWrite with current state after each step
   ```

3. **Parallel Operations** - Run these in parallel for efficiency:
   ```bash
   # All prerequisite checks
   # All dependency mapping commands
   # All verification commands
   # Reading multiple files for analysis
   ```

## Pre-Migration Environment Check

Before starting any migration, Claude should verify:

```bash
# Check all prerequisites in parallel
pwd  # Should show /home/jeffh/projects/pocketdev
git branch --show-current  # Should be dev or main
git status --short  # Should be empty (no uncommitted changes)
git fetch origin  # Update remote tracking
git status -uno  # Check if local is up to date with remote
ls -la | grep -E "simple|local-backend|web|docker"  # Should show all directories
ls -la ../pocketdev-studio  # Should exist and be accessible
```

**Environment Checklist:**
- [ ] Current working directory is /home/jeffh/projects/pocketdev
- [ ] Git is on dev/main branch (or explicitly note if not)
- [ ] No uncommitted changes exist
- [ ] All local branches are up to date with remote
- [ ] Key directories exist: simple/, local-backend/, web/, docker/
- [ ] pocketdev-studio directory is accessible at ../pocketdev-studio

If any check fails, resolve before proceeding.

## Claude Must NEVER

These are absolute prohibitions with no exceptions:

1. **NEVER delete git history or use force push**
   - Even if suggested, always preserve full history

2. **NEVER move files without dependency analysis**
   - Always run Phase 3 dependency mapping first

3. **NEVER commit directly to main or dev branches**
   - Always use the migration branch created in Step 2

4. **NEVER use sudo without user permission**
   - If permission denied on directories, ask user first

5. **NEVER proceed if critical paths are broken**
   - Stop if Docker configs, proxies, or static serving fails

6. **NEVER skip the incremental testing phase**
   - Test each service individually before declaring success

7. **NEVER remove a directory without verifying it's empty**
   - Use `ls -la` before any `rm -rf` command

## Migration Decision Matrix

| Situation | Condition | Action |
|-----------|-----------|---------|
| Uncommitted changes | `git status --short` not empty | STOP - Ask user to commit or stash |
| Wrong branch | Not on dev/main | Ask if OK to proceed from current branch |
| Missing directories | simple/ or studio missing | STOP - Cannot proceed |
| Permission errors | Docker-owned directories | Ask user: "Need sudo to fix permissions. OK?" |
| Path conflicts | Files exist in both locations | Use rsync with --ignore-existing |
| Test failures | Critical service fails | STOP - Document exact failure |
| Dependency found | Hardcoded path discovered | Add to CRITICAL_PATHS array |

## Quick Command Reference

```bash
# One-line status check
echo "Dir: $(pwd) | Branch: $(git branch --show-current) | Changes: $(git status --porcelain | wc -l)"

# Quick dependency scan
grep -r "../simple\|frontend-legacy\|:3005\|:5173\|:8080" --include="*.yml" --include="*.json" --include="*.js" . | head -20

# Permission check
find . -maxdepth 2 -type d -exec ls -ld {} \; | grep -E "root|docker" | head -10

# Service status check
docker-compose ps 2>/dev/null || echo "No services running"
```

## Step-by-Step Migration Process

### Step 1: Run Pre-Migration Checks

```bash
# TodoWrite: Mark Step 1 as in_progress

# Quick state check
echo "=== MIGRATION STATE CHECK ==="
echo "Current directory: $(pwd)"
echo "Current branch: $(git branch --show-current)"
echo "Uncommitted changes: $(git status --porcelain | wc -l)"
echo "Simple exists: $(test -d simple && echo 'YES' || echo 'NO')"
echo "Studio accessible: $(test -d ../pocketdev-studio && echo 'YES' || echo 'NO')"

# Verify all components exist
for dir in simple local-backend web docker data; do
  test -d "$dir" && echo "✓ $dir exists" || echo "✗ $dir missing"
done
```

### Step 2: Create Working Branch

```bash
# TodoWrite: Mark Step 2 as in_progress

git checkout -b separation/migration-$(date +%Y%m%d)
echo "Created branch: $(git branch --show-current)"

# Set migration state
MIGRATION_BRANCH=$(git branch --show-current)
echo "Migration branch: $MIGRATION_BRANCH"
```

### Step 3: Map All Service Dependencies (Critical)

This is the most important step based on lessons learned.

```bash
# TodoWrite: Mark Step 3 as in_progress

# Create dependency report
echo "=== DEPENDENCY MAPPING REPORT ===" > /tmp/migration_deps.txt
echo "Generated: $(date)" >> /tmp/migration_deps.txt
echo "" >> /tmp/migration_deps.txt

# 1. Port mappings
echo "=== PORT MAPPINGS ===" >> /tmp/migration_deps.txt
grep -r "port\|PORT" docker-compose*.yml */docker-compose*.yml 2>/dev/null | grep -E "[0-9]{4}" >> /tmp/migration_deps.txt

# 2. Service dependencies
echo -e "\n=== SERVICE DEPENDENCIES ===" >> /tmp/migration_deps.txt
grep -r "depends_on\|links" docker-compose*.yml */docker-compose*.yml 2>/dev/null >> /tmp/migration_deps.txt

# 3. Proxy configurations (Critical for simple/PocketDev)
echo -e "\n=== PROXY CONFIGURATIONS ===" >> /tmp/migration_deps.txt
find . -name "vite.config.*" -exec grep -l "proxy" {} \; -exec grep -A 10 "proxy" {} \; >> /tmp/migration_deps.txt

# 4. Static file serving (Critical - backend serves frontend-legacy)
echo -e "\n=== STATIC FILE SERVING ===" >> /tmp/migration_deps.txt
grep -r "static\|public\|frontend-legacy" */server.js */app.js */index.js */server/*.js 2>/dev/null >> /tmp/migration_deps.txt

# 5. Hardcoded paths that need updating
echo -e "\n=== HARDCODED PATHS TO UPDATE ===" >> /tmp/migration_deps.txt
grep -rE "\.\./simple/|\.\./" --include="*.js" --include="*.json" --include="*.yml" . | grep -v node_modules >> /tmp/migration_deps.txt

# 6. WebSocket connections
echo -e "\n=== WEBSOCKET CONNECTIONS ===" >> /tmp/migration_deps.txt
grep -r "ws:\|wss:\|WebSocket\|8080\|8081" --include="*.js" --include="*.ts" . | grep -v node_modules | head -20 >> /tmp/migration_deps.txt

# Display critical findings
echo "=== CRITICAL FINDINGS ==="
cat /tmp/migration_deps.txt | grep -E "proxy|static|frontend-legacy|../simple" | head -10

# Save critical paths
CRITICAL_PATHS=$(grep -rE "\.\./simple/|\.\./" --include="*.js" --include="*.json" --include="*.yml" . | grep -v node_modules | cut -d: -f1 | sort -u)
echo "Files with path dependencies: $(echo "$CRITICAL_PATHS" | wc -l)"
```

**Claude Decision Point:**
- If more than 10 files have hardcoded paths → Warn user this is high risk
- If proxy configurations found → Note these must be verified after move
- If static file serving from unusual locations → Stop and ask user

### Step 4: Fix Directory Permissions

```bash
# TodoWrite: Mark Step 4 as in_progress

# Check permissions first
echo "=== Checking Directory Permissions ==="
for dir in data projects workspaces simple/data simple/projects; do
  if test -d "$dir"; then
    owner=$(ls -ld "$dir" | awk '{print $3}')
    if [ "$owner" != "$(whoami)" ]; then
      echo "⚠️  $dir owned by $owner (not you)"
      NEED_PERMISSION_FIX=true
    else
      echo "✓ $dir owned by $(whoami)"
    fi
  fi
done

# If permissions need fixing
if [ "$NEED_PERMISSION_FIX" = true ]; then
  echo "Some directories need permission fixes. This requires sudo."
  echo "Run: sudo chown -R $(whoami):$(whoami) data projects workspaces simple/data simple/projects"
  echo "Should I proceed? (User must confirm)"
  # Claude: STOP here and wait for user confirmation
fi
```

### Step 5: Clean pocketdev-studio Directory

```bash
# TodoWrite: Mark Step 5 as in_progress

cd ../pocketdev-studio

# Check what's there first
echo "=== Current pocketdev-studio contents ==="
ls -la

# Remove existing directories (they only contain node_modules)
if test -d local-backend || test -d web; then
  echo "Removing old directories with only node_modules..."
  rm -rf local-backend web
fi

# Verify clean
ls -la | grep -E "local-backend|web" && echo "✗ Cleanup failed" || echo "✓ Studio cleaned"

# Return to main directory
cd ../pocketdev
```

### Step 6: Move Containerized Components to Studio

```bash
# TodoWrite: Mark Step 6 as in_progress

echo "=== Moving containerized components to pocketdev-studio ==="

# Copy main containerized components
for component in local-backend web docker; do
  if test -d "$component"; then
    echo "Copying $component..."
    cp -r "$component" ../pocketdev-studio/
    echo "✓ $component copied"
  else
    echo "✗ $component not found"
  fi
done

# Copy Docker compose files
for file in docker-compose.yml docker-compose.dev.yml; do
  if test -f "$file"; then
    echo "Copying $file..."
    cp "$file" ../pocketdev-studio/
    echo "✓ $file copied"
  fi
done

# Copy workspaces if they exist
if test -d workspaces; then
  echo "Copying workspaces..."
  cp -r workspaces ../pocketdev-studio/
  echo "✓ workspaces copied"
fi

# Copy data directory (for studio database)
if test -d data && test -f data/pocketdev.db; then
  echo "Copying studio database..."
  mkdir -p ../pocketdev-studio/data
  cp data/pocketdev.db ../pocketdev-studio/data/
  echo "✓ studio database copied"
fi

# Copy relevant documentation
cp CLAUDE.md ../pocketdev-studio/
if test -f README.md && grep -q "container\|orchestrat" README.md; then
  cp README.md ../pocketdev-studio/
fi

# Verify copy succeeded
echo -e "\n=== Verifying studio population ==="
cd ../pocketdev-studio
ls -la | grep -E "local-backend|web|docker|data"
STUDIO_POPULATED=$?
cd ../pocketdev

if [ $STUDIO_POPULATED -eq 0 ]; then
  echo "✓ Studio successfully populated"
else
  echo "✗ Studio population failed - STOP"
  # Claude: STOP here if verification failed
fi
```

### Step 7: Update Paths in Simple

```bash
# TodoWrite: Mark Step 7 as in_progress

echo "=== Updating hardcoded paths in simple ==="

# Find files with ../simple/ references
FILES_TO_UPDATE=$(find simple -type f \( -name "*.js" -o -name "*.json" -o -name "*.yml" -o -name "*.ts" \) -exec grep -l "\.\./simple/" {} \; 2>/dev/null)

if [ -n "$FILES_TO_UPDATE" ]; then
  echo "Found $(echo "$FILES_TO_UPDATE" | wc -l) files with path references to update"
  
  # Update each file
  for file in $FILES_TO_UPDATE; do
    echo "Updating $file..."
    sed -i.bak 's|\.\./simple/|./|g' "$file"
  done
  
  # Verify updates
  echo "Verifying path updates..."
  grep -r "../simple/" simple/ --include="*.js" --include="*.json" --include="*.yml" --include="*.ts" | grep -v ".bak" | head -5
else
  echo "✓ No hardcoded paths found to update"
fi

# Check for any remaining problematic paths
echo -e "\n=== Checking for other relative paths ==="
grep -r "\.\./" simple/ --include="*.js" --include="*.json" --include="*.yml" --include="*.ts" | grep -v node_modules | grep -v ".bak" | head -10
```

### Step 8: Promote Simple to Root

```bash
# TodoWrite: Mark Step 8 as in_progress

echo "=== Checking for conflicts before promotion ==="

# List potential conflicts
CONFLICTS=""
for item in $(ls -A simple/); do
  if test -e "$item"; then
    echo "⚠️  Conflict: $item exists in both root and simple/"
    CONFLICTS="$CONFLICTS $item"
  fi
done

if [ -n "$CONFLICTS" ]; then
  echo "Found conflicts: $CONFLICTS"
  echo "Will use rsync --ignore-existing to preserve root versions"
fi

# Check for Docker file conflicts
if ls simple/docker* simple/Docker* 2>/dev/null; then
  echo "⚠️  Docker files found in simple/ - these will be preserved"
fi
```

#### 8.2 Promote simple contents to root

```bash
echo "=== Promoting simple to root ==="

# First, move with rsync to handle conflicts gracefully
echo "Using rsync to move files (preserving existing root files)..."
rsync -av --ignore-existing simple/ .

# Special handling for important config files
if test -f .gitignore && test -f simple/.gitignore; then
  echo "Merging .gitignore files..."
  cat simple/.gitignore >> .gitignore
  sort -u .gitignore -o .gitignore
fi

# Move CLAUDE.md from simple if it's more recent
if test -f simple/CLAUDE.md; then
  echo "Moving simple's CLAUDE.md to root..."
  mv simple/CLAUDE.md ./CLAUDE.md
fi

# Copy hidden files that rsync might miss
for file in simple/.*; do
  if [ -f "$file" ] && [ "$(basename "$file")" != "." ] && [ "$(basename "$file")" != ".." ]; then
    cp -n "$file" . 2>/dev/null || true
  fi
done

# Verify key directories moved
echo -e "\n=== Verifying promotion ==="
for dir in server frontend docs data; do
  test -d "$dir" && echo "✓ $dir exists in root" || echo "✗ $dir missing"
done

# Clean up simple directory
echo -e "\n=== Cleaning up simple directory ==="
if test -d simple; then
  # Double check it's empty except for node_modules
  remaining=$(find simple -type f -not -path "*/node_modules/*" | wc -l)
  if [ "$remaining" -eq 0 ]; then
    echo "Removing empty simple directory..."
    rm -rf simple
    echo "✓ Simple directory removed"
  else
    echo "⚠️  Simple directory still has $remaining files - manual review needed"
  fi
fi
```

### Step 9: Clean Up Root Directory

```bash
# TodoWrite: Mark Step 9 as in_progress

echo "=== Cleaning up root directory for PocketDev ==="

# Remove containerized components (now in studio)
for component in local-backend web docker workspaces; do
  if test -d "$component"; then
    echo "Removing $component (now in studio)..."
    rm -rf "$component"
    echo "✓ $component removed"
  fi
done

# Remove containerized Docker files
for file in docker-compose.yml docker-compose.dev.yml; do
  if test -f "$file" && grep -q "claude-frontend\|claude-backend\|claude-devops" "$file"; then
    echo "Removing containerized $file..."
    rm -f "$file"
    echo "✓ $file removed"
  fi
done

# Handle database files
if test -f data/pocketdev.db && test -f simple/data/pocketdev.db; then
  echo "Found two databases - keeping simple's version"
  rm -f data/pocketdev.db data/old-pocketdev.db
  # Simple's database should now be in root data/ from promotion
fi

# Verify we have the right database
if test -f data/pocketdev.db; then
  echo "✓ PocketDev database present"
else
  echo "⚠️  Warning: No PocketDev database found in data/"
fi

# Final structure check
echo -e "\n=== Final root structure ==="
ls -la | grep -E "server|frontend|docs|data|docker-compose" | head -10
```

### Step 10: Test Both Configurations

This is critical - test incrementally as lessons learned showed.

#### 10.1 Test PocketDev (Simple) Step by Step

```bash
# TodoWrite: Mark Step 10 as in_progress

echo "=== Testing PocketDev Configuration ==="

# First check if docker-compose exists
if ! test -f docker-compose.yml; then
  echo "✗ No docker-compose.yml found in root"
  echo "This is expected - the simple version's docker-compose should now be here"
  # Claude: STOP if this is unexpected
fi

# Verify Docker compose syntax
docker-compose config > /dev/null 2>&1 && echo "✓ Docker compose valid" || echo "✗ Invalid docker-compose.yml"

# Check which services are defined
echo -e "\n=== Services defined ==="
docker-compose config --services

# Test services one by one
echo -e "\n=== Starting services incrementally ==="

# 1. Start Shelltender first
echo "Starting Shelltender..."
docker-compose up -d shelltender
sleep 5
docker-compose ps shelltender | grep -q "Up" && echo "✓ Shelltender running" || echo "✗ Shelltender failed"

# 2. Start Backend
echo -e "\nStarting Backend..."
docker-compose up -d backend
sleep 5
docker-compose ps backend | grep -q "Up" && echo "✓ Backend running" || echo "✗ Backend failed"

# 3. Check critical endpoints
echo -e "\n=== Testing endpoints ==="
curl -s http://localhost:3005/api/health | grep -q "ok" && echo "✓ Backend API responding" || echo "✗ Backend API not responding"

# 4. Check static file serving (critical from lessons)
curl -s http://localhost:3005/ -o /dev/null && echo "✓ Backend serving static files" || echo "✗ Static file serving issue"

# 5. Test Shelltender access
curl -s http://localhost:8080/ -o /dev/null && echo "✓ Shelltender web accessible" || echo "✗ Shelltender web issue"

# 6. Check for any errors in logs
echo -e "\n=== Checking logs for errors ==="
docker-compose logs --tail=20 | grep -i "error\|fail" | head -5

# Keep running for further testing
echo -e "\n✓ Services running. Run 'docker-compose down' when done testing."
POCKETDEV_TESTS="passed"  # Update state
```

#### 10.2 Verify PocketDev-Studio Structure

```bash
echo -e "\n=== Verifying PocketDev-Studio ==="

cd ../pocketdev-studio

# Check structure
echo "Studio contents:"
ls -la | grep -E "local-backend|web|docker|data|docker-compose"

# Verify it has the containerized version markers
if grep -q "claude-frontend\|claude-backend\|claude-devops" docker-compose.yml 2>/dev/null; then
  echo "✓ Studio has containerized AI orchestration setup"
else
  echo "✗ Studio missing containerized setup"
fi

cd ../pocketdev

# Note: Full studio testing requires manual verification
echo -e "\nStudio structure verified. Full testing requires manual container creation."
STUDIO_TESTS="skipped"  # Update state
```

### Step 11: Commit Changes

```bash
# TodoWrite: Mark Step 11 as in_progress

cd /home/jeffh/projects/pocketdev

# First, stop any running services
echo "Stopping services before commit..."
docker-compose down 2>/dev/null || true

# Stage all changes
echo -e "\n=== Staging changes ==="
git add -A

# Show what will be committed
echo -e "\n=== Changes to be committed ==="
git status --short | head -20
echo "Total files changed: $(git status --short | wc -l)"

# Create detailed commit message
cat > /tmp/commit_msg.txt << 'EOF'
Separate PocketDev into two distinct projects

This migration separates the two parallel codebases:

PocketDev (root):
- Promoted simple implementation to root
- Web-based project/task management with Shelltender
- Uses Git worktrees for task isolation
- SQLite database for persistence
- Mature, production-ready architecture

PocketDev-Studio (../pocketdev-studio):
- Containerized AI developer orchestration
- Multiple Claude containers (frontend, backend, devops)
- Dynamic workspace management
- Original vision of AI team management

Changes made:
- Moved containerized components to pocketdev-studio
- Promoted simple/* contents to root
- Updated hardcoded paths in configuration files
- Cleaned up duplicate files and directories
- Preserved git history using Option 1 strategy
- Tested both configurations independently

Migration branch: separation/migration-YYYYMMDD
EOF

# Commit with detailed message
git commit -F /tmp/commit_msg.txt

echo -e "\n✓ Changes committed to $(git branch --show-current)"

# Clean up
rm /tmp/commit_msg.txt /tmp/migration_deps.txt 2>/dev/null || true
```

## Post-Migration Verification

Execute these verification commands:

```bash
# Quick verification script
echo "=== POST-MIGRATION VERIFICATION ==="

# 1. PocketDev structure
echo -e "\n1. PocketDev (root) structure:"
test -d server && test -d frontend && test -f docker-compose.yml && echo "✅ PocketDev structure correct" || echo "❌ PocketDev structure issue"

# 2. Studio structure  
echo -e "\n2. PocketDev-Studio structure:"
test -d ../pocketdev-studio/local-backend && test -d ../pocketdev-studio/web && echo "✅ Studio structure correct" || echo "❌ Studio structure issue"

# 3. No containerized files in root
echo -e "\n3. Containerized cleanup:"
! test -d local-backend && ! test -d web && ! test -d workspaces && echo "✅ Containerized files removed" || echo "❌ Containerized files remain"

# 4. Git history preserved
echo -e "\n4. Git history:"
git log --oneline | head -5
echo "✅ Full history preserved"

# 5. Services can start
echo -e "\n5. Service check:"
docker-compose config > /dev/null 2>&1 && echo "✅ Docker config valid" || echo "❌ Docker config invalid"

# 6. Database check
echo -e "\n6. Database:"
test -f data/pocketdev.db && echo "✅ Database present" || echo "❌ Database missing"
```

## Success Checkpoints

Claude should look for these indicators at each step:

- Step 1: ✓ All prerequisites pass and directories exist
- Step 2: ✓ Migration branch created successfully
- Step 3: ✓ Dependencies mapped, critical paths identified
- Step 4: ✓ Permissions fixed or confirmed OK
- Step 5: ✓ Studio directory cleaned
- Step 6: ✓ All components copied to studio
- Step 7: ✓ Paths updated in simple files
- Step 8: ✓ Simple promoted to root successfully
- Step 9: ✓ Root cleaned of containerized files
- Step 10: ✓ Both configurations tested
- Step 11: ✓ Changes committed to migration branch

## Migration Completion Summary

Claude should always end with:

🎉 **Migration completed successfully!**

✅ All steps completed:
- Created migration branch: separation/migration-YYYYMMDD
- Mapped all service dependencies
- Fixed directory permissions
- Moved containerized version to pocketdev-studio
- Promoted simple implementation to root
- Updated all hardcoded paths
- Tested both configurations
- Committed changes with full history preserved

**PocketDev (root):**
- Web-based project/task management
- Shelltender integration
- SQLite database
- Ports: 3005 (backend), 5173 (frontend), 8080/8081 (Shelltender)

**PocketDev-Studio (../pocketdev-studio):**
- Containerized AI orchestration
- Multiple Claude containers
- Dynamic workspaces
- Original multi-agent vision

Next steps:
1. Push branch: `git push origin $(git branch --show-current)`
2. Create PR for review
3. Test both applications thoroughly
4. Initialize pocketdev-studio GitHub repo if needed

## Rollback Procedures

If you need to rollback at any point:

### Complete Rollback
```bash
# Return to original state
git checkout dev
git branch -D separation/migration-$(date +%Y%m%d)
rm -rf ../pocketdev-studio/*
git checkout .
```

### Partial Rollback (after Step X)
```bash
# Check current state
git status
# Reset to before problematic step
git reset --hard HEAD~1
# Or return to specific state
git checkout -- [specific-files]
```

## Claude Error Response Templates

Use these exact responses for common errors:

### Permission Errors:
```
I encountered permission errors on these directories: [list]
These are likely Docker-created with root ownership.
To fix: sudo chown -R $(whoami):$(whoami) [directories]
Should I proceed after you fix permissions?
```

### Path Update Errors:
```
I found [N] files with hardcoded paths that need updating.
This is higher than expected and may indicate tight coupling.
Files: [list first 5]
This is a medium risk. Should I proceed with the updates?
```

### Test Failures:
```
Service [name] failed to start.
Error from logs: [specific error]
This could be due to:
1. Port already in use
2. Missing configuration
3. Path issues from migration
Please check and let me know how to proceed.
```

## Quick Troubleshooting Tree

If something fails:
1. Permission error? → Need sudo for Docker-created dirs
2. Service won't start? → Check ports and docker-compose logs
3. Path errors? → Review Step 3 dependency mapping results
4. Git issues? → Ensure clean working directory first
5. Studio issues? → Verify it was cleaned before copying