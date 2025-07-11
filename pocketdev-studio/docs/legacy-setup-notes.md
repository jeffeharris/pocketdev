# Legacy Setup Notes

These notes were from earlier iterations of PocketDev and contain useful historical context.

## From CLAUDE-FILE-CREATION.md

### How File Creation Works
1. You ask Claude to create code
2. Claude responds with code in markdown code blocks
3. PocketDev extracts the code blocks
4. Files are automatically saved to workspace

### Prompting Tips
- Instead of: "Help me with authentication"
- Try: "Write a complete authentication system with the following files: auth.js, login.jsx, and middleware/authCheck.js"

## From CLAUDE_CODE_SETUP.md

### API Key Setup
```bash
# Set your API key
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# For Docker/VM deployment
echo "ANTHROPIC_API_KEY=sk-ant-api03-..." > .env
```

## From DOCKER_SETUP.md

### Host Mode Setup
```bash
# Configure for host mode
echo "CLAUDE_MODE=host" >> local-backend/.env
```

### Workspace Structure
- `workspaces/frontend/` - Frontend engineer workspace
- `workspaces/backend/` - Backend engineer workspace  
- `workspaces/devops/` - DevOps engineer workspace

## From SETUP.md

### Original Architecture (OpenAI + Supabase)
The original PocketDev used:
- Supabase for database and real-time updates
- OpenAI assistants for AI engineers
- React Native mobile app
- Vercel API deployment

This has now evolved to use Claude CLI with containerized execution.