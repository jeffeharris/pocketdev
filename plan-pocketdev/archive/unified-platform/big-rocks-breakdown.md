# PocketDev Unified Platform - Big Rocks Breakdown

<!-- Document Metadata
Created: 2025-07-01
Modified: 2025-07-11
Status: ????
-->


## Overview
This document outlines the major architectural changes needed to merge the simple server with the AI automation components into a unified platform.

## Big Rocks Priority Order

### 🪨 Big Rock #1: React UI Overhaul
**Why First**: Provides immediate visual impact and better UX while backend evolves
- Port the slick prototype (`pocketdev-task-view.tsx`) to production
- Replace current basic HTML pages with modern React components
- Implement 3-phase workflow: Generate → Validate → Merge
- Add lens slider animation between validate/merge phases
- Support multiple concurrent tasks with easy switching

### 🪨 Big Rock #2: Docker-in-Docker (DinD) Implementation
**Purpose**: Enable AI agents to launch and test containers autonomously
- Give AI agents running in Shelltender the ability to:
  - Run `docker` commands to test their code
  - Spin up services with `docker-compose`
  - Self-validate before human review
- Each task gets its own Docker daemon for complete isolation
- This is THE architectural change that enables validation

### 🪨 Big Rock #3: URL Routing & Preview Infrastructure
**Purpose**: Make AI-launched services accessible to humans
- Implement nginx path-based routing for clean URLs
- Direct port access (9001-9010) for WebSockets/HMR
- Enable preview URLs that work in iframes
- Support both AI and human access to running services

### 🪨 Big Rock #4: Git/PR Integration
**Purpose**: Complete the code delivery workflow
- Robust conflict detection before merge attempts
- PR creation with AI-generated descriptions
- Three-tier conflict resolution:
  1. Copy git commands (simple)
  2. Open in GitHub (visual)
  3. Shelltender terminal session (advanced)

### 🪨 Big Rock #5: Unified Task Model & Container Orchestration
**Purpose**: Reconcile different execution models
- Extend SQLite schema for container tracking
- Support both terminal and container execution modes
- Port memory enhancement system from AI automation
- Unified monitoring for all execution types

## Key Insights

### The Real Vision
The DinD implementation fundamentally transforms the AI agent capabilities:
- **Current**: AI works in terminal but can't test services
- **Future**: AI can build, deploy, test, and validate autonomously
- **Human Role**: Shifts from debugging to final approval

### Implementation Strategy
1. **UI First**: Get the interface working with existing capabilities
2. **Progressive Enhancement**: Features "light up" as backend develops
3. **Maintain Compatibility**: Keep existing functionality working throughout

## Success Metrics
- AI agents can self-test their implementations
- Humans can preview running services easily
- Support 5+ concurrent tasks without conflicts
- Task creation to validation < 30 seconds
- Zero port conflicts between tasks