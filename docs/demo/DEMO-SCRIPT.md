# PocketDev Demo Script

## Setup (Before Demo)

1. **Ensure Docker services are running:**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **Check services are healthy:**
   ```bash
   docker ps | grep pocketdev
   ```

3. **Open browser to:** http://localhost:5173

## Demo Flow

### 1. Show the Problem (30 seconds)
"Managing AI developers is hard - they need credentials, proper task descriptions, and the right environment setup. Let me show you what happens when things go wrong..."

**Action:** Try to assign a task with intentionally bad inputs:
- Repository: `not-a-valid-url`
- Description: `Fix bug`
- No acceptance criteria

### 2. Show the Supervisor in Action (1 minute)
"Instead of cryptic error messages, our AI Supervisor analyzes what went wrong and provides helpful guidance..."

**What to highlight:**
- The amber "Supervisor Analysis" box
- Natural language summary: "I need valid credentials to complete this task"
- Specific explanations for each issue
- Numbered next steps
- Quick fixes with examples

### 3. Fix One Issue at a Time (1 minute)
"Let's fix these issues step by step..."

**Fix #1:** Update repository URL
- Change to: `https://github.com/octocat/Hello-World`
- Show how error count decreases

**Fix #2:** Improve task description
- Change to: `Add a React component that displays the current date and time, updating every second`
- Add acceptance criteria: 
  - "Shows date in readable format"
  - "Updates every second"
  - "Has nice styling"

### 4. Show Progress Monitoring (30 seconds)
"Once everything is valid, you can watch the AI developer's progress in real-time..."

**What to show:**
- Progress indicators (if task succeeds)
- Real-time status updates
- Human-friendly checkpoint messages

## Key Talking Points

1. **"Fail Fast, Fail Friendly"**
   - No wasted container resources on invalid tasks
   - Immediate, actionable feedback
   - Learn what's needed before expensive operations

2. **"AI Supervisor as Team Lead"**
   - Not just error messages, but guidance
   - Helps users understand what AI developers need
   - Progressive disclosure (brief summary → detailed steps)

3. **"Enterprise Ready"**
   - Full audit trail of attempts
   - Cost tracking (show $0 for failed validations)
   - Memory system learns from failures

## Demo Tips

- **Keep credentials handy** (but don't show them)
- **Have a backup plan** - screenshot of successful task
- **Emphasize the supervisor's personality** - it's helpful, not condescending
- **Show the raw error comparison** - what it would look like without the supervisor

## Quick Reset Between Demos

```bash
# Clear recent failed tasks (optional)
docker exec pocketdev-backend-1 node -e "
// This would clear recent tasks - implement if needed
console.log('Tasks cleared');
"
```