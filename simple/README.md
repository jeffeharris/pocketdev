# PocketDev Simple - Minimal Mobile Claude Interface

A lightweight, mobile-friendly web interface for managing Claude Code sessions without remote desktop. Submit tasks, review outputs, and manage code changes from your phone.

## What We Learned

### 1. The stdin Problem
**Issue**: Claude CLI was hanging when spawned from Node.js
**Root Cause**: The Claude CLI was waiting for stdin input when launched via `spawn()`
**Solution**: Close stdin immediately after spawning: `claude.stdin.end()`

```javascript
const claude = spawn('claude', args, { 
  cwd: worktreePath,
  stdio: ['pipe', 'pipe', 'pipe'] 
});
claude.stdin.end(); // Critical fix!
```

### 2. Docker Environment Matters
**Issue**: Alpine Linux's busybox `env` doesn't support the `-S` flag used in Claude's shebang
**Solution**: Use Debian-based images (`node:20-slim`) instead of Alpine

### 3. Git Worktrees for Isolation
**Why**: Each task gets its own isolated branch and working directory
**Benefit**: Multiple tasks can run in parallel without conflicts
**Pattern**: 
```bash
git worktree add -b pocketdev/task-name-123 /tmp/worktrees/123 main
```

### 4. Tool Permissions Required
**Issue**: Claude needs explicit permission to use tools
**Solution**: Add `--allowedTools Write,Edit,Read,Bash` to Claude arguments

### 5. Session Continuity
**Key**: Claude's `--resume <session-id>` flag enables follow-up conversations
**Implementation**: Store session ID from initial response, pass to follow-ups

## Quick Start

### 1. Setup
```bash
cd simple
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### 2. Run
```bash
docker-compose up
```

### 3. Configure GitHub (First Time)
- Open http://localhost:2424
- Click the ⚙️ Settings button
- Enter your GitHub username and Personal Access Token
- Click "Load" to see your repositories
- Select a repository and default branch
- Save configuration

### 4. Use
- Type what you want done
- Claude executes in an isolated git worktree
- Follow up or accept changes
- Accepting commits and creates a branch ready for PR

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   Express   │────▶│   Claude    │
│  (Mobile)   │◀────│   Server    │◀────│    CLI      │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │     Git     │
                    │  Worktrees  │
                    └─────────────┘
```

## API Endpoints

- `POST /api/task` - Submit new task
- `POST /api/task/:id/followup` - Continue conversation  
- `POST /api/task/:id/accept` - Accept changes & cleanup
- `GET /health` - Check server status

## Core Features

✅ **Mobile-First UI** - Simple chat interface, touch-friendly  
✅ **GitHub Integration** - Clone, sync, and push to remote repositories  
✅ **Git Worktrees** - Each task in isolated worktree  
✅ **Real Claude Execution** - Full Claude CLI with tool access  
✅ **Session Management** - Follow-up conversations maintain context  
✅ **Branch Creation** - Ready for PR submission  
✅ **Configuration UI** - Easy GitHub token and repository setup

## What This Replaces

Instead of:
1. Remote desktop from phone
2. Terminal typing on small screen
3. Managing git branches manually
4. Losing context between commands

You get:
1. Native web interface
2. Touch-friendly task submission
3. Automatic branch management
4. Persistent conversation context

## Deployment Notes

For production:
- Mount your actual git repository to `/workspace`
- Set up proper git credentials for pushing
- Consider adding authentication
- Use HTTPS for secure mobile access

## Future Enhancements

- WebSocket for real-time streaming
- Multiple repository support
- Task history and search
- Team collaboration features
- Voice input for task submission