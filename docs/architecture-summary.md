# PocketDev Architecture Summary

## Vision
Transform from individual AI assistance to team-based AI engineering management, enabling users to orchestrate specialized AI developers across multiple projects with persistent knowledge and learning.

## Key Innovation: Separation of Concerns

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   PROFILES      │     │   CONTAINERS    │     │   PROJECTS      │
│ (Knowledge)     │ --> │ (Compute)       │ --> │ (Context)       │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ • Personality   │     │ • Docker        │     │ • Repository    │
│ • Expertise     │     │ • Resources     │     │ • Credentials   │
│ • Learning      │     │ • Ephemeral     │     │ • Settings      │
│ • Persistent    │     │ • Pooled        │     │ • Knowledge     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Engineer Ecosystem

### Development Team
- **Frontend Engineer**: React, Vue, UI implementation
- **Backend Engineer**: APIs, databases, business logic
- **DevOps Engineer**: Infrastructure, CI/CD, deployment
- **Fullstack Engineer**: End-to-end feature development

### Quality Team
- **QA Manual**: Exploratory testing, user flows
- **QA Automation**: Test scripts, regression suites
- **QA Performance**: Load testing, optimization

### Planning Team
- **Designer**: UI/UX, mockups, design systems
- **Architect**: System design, technical specs
- **Product Manager**: Requirements, user stories

### Support Team
- **Support Engineer**: Bug investigation, debugging
- **SRE**: Production issues, monitoring

## Task Lifecycle

```
1. QUEUED       → Task created, waiting for assignment
2. IN_PROGRESS  → Engineer actively working
3. VERIFYING    → Running tests/verification
4. AWAITING_REVIEW → Complete, needs human review
5. ACCEPTED/REJECTED → Human decision made
6. FOLLOW_UP    → Additional work requested (optional)
```

## Container Pool Management

```
Team Container Pool (3 containers)
    │
    ├── Container 1: [Available]
    ├── Container 2: [Working on Task A as Frontend Engineer]
    └── Container 3: [Awaiting Review for Task B as QA]

When new task arrives:
1. Find available container
2. Load engineer profile + project knowledge
3. Execute task
4. Wait for review (10min timeout)
5. Release back to pool
```

## Knowledge Hierarchy

```
1. Base Role Knowledge
   └── "I'm a React expert"
   
2. Team Preferences
   └── "We use TypeScript strictly"
   
3. Project Specifics
   └── "This app uses Redux Toolkit"
   
4. Learned Patterns
   └── "The auth flow is in /src/auth"
```

## File Structure

```
project-root/
├── .pocketdev/
│   ├── config.json          # Project settings
│   ├── team-memory.md       # Shared knowledge
│   ├── engineers/           # Per-role learnings
│   │   ├── frontend.md
│   │   ├── backend.md
│   │   └── qa.md
│   ├── guides/              # Custom docs
│   └── BUGS.md             # Bug tracking
└── [project files]
```

## Implementation Phases

### Phase 1: Database & Persistence (Weeks 1-3)
- **Impact**: Tasks persist, review workflow, cost tracking
- **Metric**: 30% error reduction via review process

### Phase 2: Engineer Profiles (Weeks 4-6)
- **Impact**: Engineers learn and improve
- **Metric**: 20% fewer task failures

### Phase 3: Container Pool (Weeks 7-10)
- **Impact**: Multi-project support, resource optimization
- **Metric**: 50% faster task starts

### Phase 4: QA Integration (Weeks 11-14)
- **Impact**: Quality gates, automated testing
- **Metric**: 40% fewer production bugs

### Phase 5: Multi-Tenancy (Weeks 15-18)
- **Impact**: Team collaboration, shared resources
- **Metric**: 30% team productivity increase

### Phase 6: Conversational Roles (Weeks 19-21)
- **Impact**: Design/planning automation
- **Metric**: 50% faster design phase

## Success Metrics

- **Task Success Rate**: 70% → 90%
- **Average Completion Time**: 45min → 15min
- **Cost per Task**: Track and optimize
- **Knowledge Retention**: Patterns remembered
- **Bug Detection**: 40% caught before production
- **Team Efficiency**: 3x productivity with AI team

## Technical Stack

- **Database**: Supabase (PostgreSQL + Realtime)
- **Backend**: Node.js, Express, Docker SDK
- **Frontend**: React, TypeScript, Tailwind
- **AI**: Claude API with session management
- **Infrastructure**: Docker containers, Redis cache
- **Security**: Encrypted credentials, isolated workspaces

## Next Steps

1. Review architecture documents
2. Approve Phase 1 implementation
3. Set up Supabase project
4. Begin database migration
5. Update UI for task review workflow