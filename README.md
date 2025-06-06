# PocketDev - AI Engineering Management Platform

Manage your AI development team from your phone. See real-time status updates as AI engineers work on your tasks.

**Note**: The web interface is designed to be mobile-first, allowing you to manage your AI dev team from any device. A responsive web app approach was chosen to enable rapid iteration and user feedback before committing to native mobile apps.

## What We Built

A working prototype that demonstrates:

1. **Mobile App (React Native)** 
   - Real-time status dashboard showing all AI engineers
   - Task assignment interface 
   - Live progress updates (😴 → 🤔 → 💻 → ✅)

2. **Lightweight Backend (Vercel + Supabase)**
   - Minimal compute costs - just status tracking
   - Real-time subscriptions for instant updates
   - All heavy lifting done by OpenAI's infrastructure

3. **OpenAI Integration**
   - Engineers can run using Claude Code or OpenAI Codex
   - Tasks run on OpenAI's compute
   - Status updates stream back to mobile

## Architecture

```
iPhone App → Supabase (real-time) → Vercel API → OpenAI Assistants
```

The key insight: We only pay for lightweight coordination. OpenAI handles all the expensive compute.

## Quick Start

See [SETUP.md](./SETUP.md) for detailed setup instructions.

## Project Structure

```
pocketdev/
├── pocketdev-mobile/     # React Native app
│   ├── screens/          # Status & task assignment screens  
│   ├── types/            # TypeScript definitions
│   └── lib/              # Supabase client
├── api/                  # Vercel serverless functions
│   ├── assign-task.ts    # Task assignment endpoint
│   └── openai-assistant.ts # OpenAI integration
└── docs/                 # Project documentation
```

## Next Steps

- Add voice input for task assignment
- Implement task history view
- Add multi-project support
- Create specialized engineer roles
- Build team coordination features