# PocketDev Architecture Update - June 2025

## Overview

This document outlines the significant architectural evolution of PocketDev from a simple task runner to a comprehensive AI Engineering Management Platform. This update introduces persistent storage, intelligent engineer profiles, resource pooling, and a complete development team including QA, design, and support roles.

## Why This Update?

### Current Limitations
- Tasks are lost on restart (in-memory storage)
- No learning between tasks (ephemeral engineers)
- No formal review process for completed work
- Limited to development roles only
- No quality assurance integration

### What We're Building
- Persistent task history with review workflows
- AI engineers that learn and improve over time
- Efficient container pooling (3 containers shared across all engineers)
- Complete development team: Dev, QA, Design, Product, Support
- Knowledge management system that grows with usage

## Core Architectural Changes

### 1. Separation of Concerns
We're separating the "brains" from the "hands":
- **Engineer Profiles**: Persistent knowledge, personality, and expertise
- **Containers**: Ephemeral compute resources from a shared pool
- **Knowledge**: Hierarchical system from base role → team → project → learned

### 2. Database-First Approach
Moving from in-memory to PostgreSQL (via Supabase):
- Task persistence with full history
- Engineer performance tracking
- Project and credential management
- Real-time subscriptions for live updates

### 3. Container Pool Management
Instead of one container per engineer:
- Pool of 3 containers per team (configurable)
- Any container can "become" any engineer by loading their profile
- 10-minute review timeout before releasing back to pool
- Dynamic scaling for urgent tasks

### 4. Complete Development Team

#### Development Roles
- Frontend, Backend, DevOps, Fullstack

#### Quality Roles (NEW)
- QA Manual, QA Automation, QA Performance

#### Design & Planning Roles (NEW)
- Designer, Architect, Product Manager

#### Support Roles (NEW)
- Support Engineer, SRE

## Implementation Roadmap

### Phase 1: Database & Task Persistence (Current Priority)
**Timeline**: 2-3 weeks
**Deliverables**:
- Database schema implementation
- Task states: queued → in_progress → awaiting_review → accepted/rejected
- Review UI in TaskView component
- Metrics tracking (cost, duration, tokens, turns)

**Expected Outcome**: 30% error reduction through review process

### Phase 2: Engineer Profiles & Knowledge
**Timeline**: 2-3 weeks
**Deliverables**:
- Persistent engineer profiles
- Knowledge accumulation in `.pocketdev/`
- Project-specific learning system

**Expected Outcome**: 20% reduction in task failures

### Phase 3: Container Pool & Multi-Project
**Timeline**: 3-4 weeks
**Deliverables**:
- Container pool manager
- Multi-project support
- Resource optimization

**Expected Outcome**: 50% faster task starts

### Phase 4: QA Integration
**Timeline**: 3-4 weeks
**Deliverables**:
- QA engineer roles
- Automated test generation
- Bug tracking in BUGS.md

**Expected Outcome**: 40% fewer production bugs

### Phase 5: Conversational Roles
**Timeline**: 2-3 weeks
**Deliverables**:
- Design/Architecture/Product roles
- Chat-based exploration UI
- Markdown artifact generation

**Expected Outcome**: 50% faster design phase

## Documentation Structure

This update is documented across several files:

1. **This file** (`ARCHITECTURE-UPDATE-JUNE-2025.md`) - Starting point and overview
2. [`architecture-summary.md`](architecture-summary.md) - Quick visual reference
3. [`multi-tenant-architecture.md`](multi-tenant-architecture.md) - Complete technical specification
4. [`implementation-roadmap.md`](implementation-roadmap.md) - Detailed phase plan
5. [`phase-1-database-schema.md`](phase-1-database-schema.md) - Database schema for Phase 1

## Key Technical Decisions

### Why Supabase?
- Built-in real-time subscriptions
- Secure credential storage (Vault)
- Faster development than custom backend
- PostgreSQL for complex queries

### Why Container Pooling?
- 50% faster task assignment
- Better resource utilization
- Predictable costs
- No idle containers with loaded contexts

### Why Separate Profiles from Containers?
- Knowledge persists, compute doesn't
- Any container can be any engineer
- Efficient memory usage
- Easy to scale up/down

### Why Knowledge in `.pocketdev/`?
- Version controlled with code
- Engineers can read during tasks
- Easy to review and edit
- Natural git workflow

## Getting Started with Phase 1

1. **Review** the [Phase 1 Database Schema](phase-1-database-schema.md)
2. **Set up** Supabase project
3. **Implement** database tables and migrations
4. **Update** task creation to use database
5. **Add** review UI to TaskView component
6. **Test** with existing container system

## Success Metrics

### Phase 1 Success Criteria
- [ ] All tasks persisted to database
- [ ] Review workflow functional
- [ ] Historical task viewing
- [ ] Cost and metrics tracking
- [ ] 30% reduction in task errors

### Overall Project Success
- Task success rate: 70% → 90%
- Average completion time: 45min → 15min
- Bug escape rate: 40% → 10%
- Documentation coverage: 0% → 100%

## Next Steps

1. **Approve** this architectural direction
2. **Review** the detailed documentation
3. **Begin** Phase 1 implementation
4. **Track** metrics from day one

## Questions?

- Technical details: See [`multi-tenant-architecture.md`](multi-tenant-architecture.md)
- Implementation timeline: See [`implementation-roadmap.md`](implementation-roadmap.md)
- Quick reference: See [`architecture-summary.md`](architecture-summary.md)

---

*Created: June 7, 2025*
*Status: Ready for Implementation*