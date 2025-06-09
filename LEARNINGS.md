# Key Learnings from PocketDev Development

## The Journey

We started with a complex multi-engineer system and discovered that the core need was much simpler: manage Claude Code from a mobile device without remote desktop.

## Critical Technical Discoveries

### 1. The stdin Hanging Bug
**Problem**: Claude CLI would hang indefinitely when spawned from Node.js
**Discovery Process**:
- Manual execution worked: `docker exec ... claude -p "task"`
- Spawned execution hung forever
- No output, no errors, just silence

**Root Cause**: Claude CLI was waiting for stdin input
**Fix**: Close stdin immediately after spawning
```javascript
const claude = spawn('claude', args, options);
claude.stdin.end(); // This single line fixed everything
```

### 2. Alpine vs Debian for Claude
**Problem**: Claude wouldn't run on Alpine Linux
**Error**: `/usr/bin/env: unrecognized option: S`
**Cause**: Claude's shebang uses `#!/usr/bin/env -S node` which Alpine's busybox doesn't support
**Fix**: Use Debian-based images (`node:20-slim`)

### 3. Tool Permissions
**Problem**: Claude responded but couldn't create files
**Error**: "I need permission to write files"
**Fix**: Add `--allowedTools Write,Edit,Read,Bash` to Claude arguments

## Architecture Insights

### What Worked Well

1. **Git Worktrees** - Perfect for task isolation
   - Each task gets its own branch
   - No conflicts between parallel tasks
   - Easy cleanup

2. **Simple Express + Static HTML** - No framework overhead
   - Fast to build and deploy
   - Easy to understand
   - Mobile-friendly without complexity

3. **JSON Output Mode** - Clean integration
   - `--output-format json` provides structured responses
   - Includes session IDs for continuity
   - Cost tracking built-in

### What We Avoided

1. **Complex State Management** - In-memory Map was sufficient
2. **Database Dependencies** - Not needed for MVP
3. **Authentication** - Can be added later
4. **WebSockets** - Polling would work for mobile use case

## Product Insights

### The Real Use Case
"I want to submit a quick task to Claude from my phone without dealing with remote desktop and terminal typing"

### What Users Actually Need
1. Text input for task description
2. See Claude's response
3. Option to follow up or accept
4. Automatic git branch management

### What They Don't Need (Yet)
- Multiple AI engineers
- Complex project management
- Elaborate folder structures
- Heavy process documentation

## Development Approach

### Start Simple
We built a 200-line server and single HTML file that solved the core problem before adding complexity.

### Test the Integration Points
The hardest bugs were in the integration between:
- Node.js spawn and Claude CLI
- Docker containers and git repositories  
- Frontend and backend communication

### Debug Methodically
When Claude hung, we:
1. Tested manual execution ✓
2. Added logging everywhere
3. Tried different spawn options
4. Discovered stdin was the issue
5. Fixed with one line

## Mobile-First Considerations

1. **Large Touch Targets** - Buttons sized for fingers
2. **Minimal Scrolling** - Everything visible on one screen
3. **Simple Actions** - Type, Send, Accept, Start Over
4. **No Gestures Required** - Just taps and typing

## Deployment Simplicity

The entire app runs with:
```bash
docker-compose up
```

No complex setup, no multiple services, just:
- One container with Node + Claude
- One nginx container for static files
- Git repository mounted as volume

## Conclusion

The journey from complex multi-agent system to simple task interface taught us:
1. Solve the immediate problem first
2. Integration bugs are often the hardest
3. Simple architecture enables rapid iteration
4. Mobile constraints force good design

The final solution is ~300 lines of code that replaces remote desktop for Claude Code management.