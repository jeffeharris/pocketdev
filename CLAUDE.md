# CLAUDE.md - PocketDev Simple Server

This file provides guidance to Claude Code and other AI agents when working with code in this repository.

## Project Overview

PocketDev Simple Server is a web-based system for managing AI development teams. The core concept is to treat AI developers (Claude, Codex, Gemini, etc.) like a real development team, where you can:

- Assign tasks to different AI developers
- Each AI works in their own isolated git worktree (branch)
- Monitor their progress in real-time
- Review and merge their work
- Maintain persistent context across sessions

Think of it as "GitHub Projects meets AI team management" - you're the engineering manager, and the AIs are your developers.

## Architecture Philosophy

### Current Implementation
- **Monolithic Approach**: All AI agents run on a single Shelltender server
- **Git Worktrees**: Each task gets its own isolated working directory
- **Persistent Sessions**: AI conversations and context persist across reconnections
- **Web-Based Management**: Everything is controlled through a web UI

### Why This Architecture?
1. **Simplicity**: One server to manage, not a container per task
2. **Resource Efficiency**: Shared AI tools and dependencies
3. **Fast Task Switching**: Worktrees are lightweight compared to containers
4. **Unified Monitoring**: All AI activity visible in one place

### Future Vision
Eventually, each task could run in its own container for better isolation, but the current approach prioritizes getting a working system quickly.

## Available AI Developers

The system comes pre-configured with multiple AI coding assistants:
- **Claude** (Anthropic) - General purpose, great at understanding context
- **Codex** (OpenAI) - Optimized for code generation
- **Gemini** (Google) - Multimodal capabilities
- **Aider** - Can use any of the above models

## Key Concepts

### Projects = Git Repositories
Each project is a cloned git repository that serves as the base for all work.

### Tasks = Git Worktrees
Each task creates a new worktree (lightweight git branch checkout) where an AI developer can work independently.

### Sessions = Persistent AI Conversations
When you open a terminal for a task, you're connecting to a persistent session where the AI remembers previous context.

## Usage Pattern

1. **Create a Project**: Clone a git repository
2. **Create a Task**: Define what needs to be done
3. **Open Terminal**: Launch an AI developer session
4. **AI Works**: The AI developer works in their isolated environment
5. **Review & Merge**: Check the work and merge when ready

## Development Guidelines

When working on this codebase:
1. **Maintain Simplicity**: This is the "simple server" - avoid over-engineering
2. **Focus on Developer Experience**: Make it easy to manage AI developers
3. **Preserve Context**: AI context persistence is the killer feature
4. **Keep It Web-Based**: Everything should be accessible through a browser

## Frontend Development Notes

### Import Resolution with Vite
When working with the React/TypeScript frontend in `simple/frontend`:

**Important**: Vite/browser ES modules don't resolve barrel exports properly. Always use direct imports with actual file paths.

❌ **Don't use barrel exports:**
```typescript
import { Task, Project } from '../types';  // This will fail in browser
```

✅ **Use direct imports instead:**
```typescript
import { Task } from '../types/task';
import { Project } from '../types/project';
```

This is because:
- Vite serves files as-is to the browser during development
- The browser can't understand barrel exports without a build step
- Direct file imports work naturally with ES modules

Always specify the full path to the actual TypeScript file (without the extension).