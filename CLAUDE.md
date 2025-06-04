# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PocketDev is an AI Engineering Management Platform that enables users to manage AI developers like a team from their mobile devices. The vision is to transform from individual AI assistance to team orchestration, allowing users to manage specialized AI developers working on different parts of projects with persistent context across weeks/months.

### Key Concept
"Be the engineering manager of an AI development team from your phone" - focusing on lightweight, mobile-first interaction with AI developers rather than heavyweight project management.

## Related Documentation

- `/docs/1. initial conversation and brainstorming with Claude.docx` - Original brainstorming session exploring parallel Claude execution, GitHub Actions integration, and mobile management vision
- `/docs/2. tech-stack-and-architecture-research.md` - Comprehensive technical research on multi-agent frameworks, state management, and architecture decisions
- `/docs/3. ai-dev-manager-canvas.md` - Product canvas with milestones, use cases, and business model

## Architecture & Tech Stack

### MVP Stack (Recommended)
- **OpenAI Assistants API** - Core AI capabilities with conversation state management
- **Supabase** - Authentication, real-time database, and API gateway
- **React Native** - Cross-platform mobile app development
- **Vercel** - Serverless API endpoints and web dashboard
- **Redis** - Caching and real-time coordination

### Future Architecture (Multi-Agent)
- **CrewAI** - Multi-agent orchestration framework (chosen for mobile-first simplicity)
- **PostgreSQL** - Primary data store with JSONB for flexible schemas
- **Vector DB (Pinecone/Qdrant)** - Semantic memory for AI context
- **NATS/RabbitMQ** - Message queue for agent coordination
- **AppSync/gRPC** - Real-time communication

## Key Implementation Priorities

1. **Context Persistence** - The #1 priority is building robust context management that survives app restarts and maintains AI developer memory across sessions

2. **Mobile-First UX** - All interfaces should be optimized for mobile interaction, including voice input and gesture-based controls

3. **Real-time Updates** - Use Supabase real-time subscriptions for live status updates without draining mobile battery

4. **Project Isolation** - Maintain strict separation between different project contexts to prevent context bleeding

5. **Lightweight Over Process** - Focus on quick actions and monitoring rather than heavyweight documentation or elaborate folder structures

## Core Use Cases to Implement

### Primary Mobile Workflows
1. **Task Assignment** - Voice/text input to assign work to AI developers
2. **Status Monitoring** - Real-time view of what each AI is working on
3. **Quick Approvals** - Swipe-based code review and deployment approvals
4. **Emergency Response** - Rapid issue triage and hotfix delegation

### Multi-Project Management
- View all active AI threads across different repositories
- Start parallel tasks across multiple projects
- Coordinate dependencies between AI developers
- Switch contexts seamlessly without losing state

## Design Philosophy

Based on lessons from claude-simone analysis:
- **Avoid process theater** - No elaborate folder structures or heavy documentation
- **Developer-native** - Integrate with existing tools (GitHub, terminals) rather than creating new systems
- **Mobile-optimized** - Every feature must work well on a phone screen
- **Outcome over process** - Focus on getting work done, not organizing work

## Code Architecture Patterns

### AI Developer Management
```javascript
// Expected pattern for AI developer abstraction
class AIDeveloper {
  async assignTask(description, files) {
    const context = await this.buildContext(description);
    return await this.sendToOpenAI(context + description);
  }
}
```

### State Management
- Use project-based state isolation with PostgreSQL schemas
- Implement checkpoint patterns for long-running operations
- Cache active sessions in Redis with LRU eviction

### Real-time Communication
- AppSync GraphQL subscriptions for active sessions
- Firebase Cloud Messaging for background notifications
- Server-Sent Events (SSE) for unidirectional status streaming

## Project Milestones

1. **Milestone 1 (Weeks 1-4)**: Single AI developer management from mobile
2. **Milestone 2 (Weeks 5-10)**: Production-ready with multiple projects
3. **Milestone 3 (Weeks 11-18)**: Multi-AI developer orchestration
4. **Milestone 4 (Weeks 19-26)**: Enterprise features and integrations