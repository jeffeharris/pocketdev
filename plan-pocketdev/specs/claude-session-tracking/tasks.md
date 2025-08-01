# Claude Session Tracking Implementation Plan

## Overview
This implementation plan breaks down the Claude session tracking feature into demoable milestones, testable phases, and actionable tasks.

## Milestone 1: Core Infrastructure
**Goal**: Database schema and basic API endpoint working
**Demo**: Ability to manually create agent sessions via API

### Phase 1.1: Database Schema Implementation
- [ ] Create migration file `003_add_agent_sessions.sql` (REQ-CST-007, REQ-CST-008)
- [ ] Implement and test migration script execution
- [ ] Verify indexes are properly created (REQ-CST-009)
- [ ] Run migration on development database
- [ ] Create rollback script for safety

### Phase 1.2: Model Layer Implementation
- [ ] Create `AgentSessionModel` class in `backend/db/models/agentSession.model.js` (REQ-CST-002)
- [ ] Implement CRUD methods: create, getById, getByTerminalSessionId, getByAgentSessionId
- [ ] Add model to database initialization
- [ ] Write unit tests for model methods
- [ ] Update TerminalSessionModel to handle current_agent_session_id field (REQ-CST-004)

### Phase 1.3: API Endpoint Implementation
- [ ] Create `agentSession.controller.js` with createAgentSession function (REQ-CST-001)
- [ ] Create `agentSession.routes.js` for POST /api/agent-sessions
- [ ] Add input validation for required fields
- [ ] Implement error handling for missing terminal sessions
- [ ] Add route to main Express app
- [ ] Write integration tests for API endpoint

## Milestone 2: Real-time Updates
**Goal**: WebSocket broadcasting of agent session events
**Demo**: Live updates in frontend when sessions are created

### Phase 2.1: WebSocket Integration
- [ ] Add AGENT_SESSION_CREATED event type to websocket utilities (REQ-CST-013)
- [ ] Implement broadcastToTask in agent session controller (REQ-CST-014)
- [ ] Test WebSocket event delivery with multiple clients
- [ ] Add optional global broadcast capability as discussed

### Phase 2.2: Frontend Integration (Optional)
- [ ] Update useWebSocket hook to handle agent_session_created events
- [ ] Add UI elements to display current agent session ID
- [ ] Show agent session history for each terminal
- [ ] Test real-time updates across multiple browser sessions

## Milestone 3: Claude Integration
**Goal**: Automatic session tracking when Claude starts
**Demo**: Launch Claude and see session ID appear automatically

### Phase 3.1: Hook Script Implementation
- [ ] Create lightweight shell script `claude-session-start-hook.sh` (REQ-CST-010, REQ-CST-011)
- [ ] Implement curl-based API call with proper error handling (REQ-CST-012)
- [ ] Add silent failure mechanism (REQ-CST-005)
- [ ] Make script executable and test independently
- [ ] Add logging for debugging (to separate log file)

### Phase 3.2: Terminal Service Integration
- [ ] Modify `terminal.service.js` launchAIInTerminal method
- [ ] Set DB_SESSION_ID environment variable for Claude sessions (REQ-CST-010)
- [ ] Configure Claude command with --session-start-hook parameter
- [ ] Test with actual Claude launches
- [ ] Verify hook doesn't block Claude execution

## Milestone 4: Multi-Agent Support
**Goal**: Extend system to track other AI agents
**Demo**: Track sessions from multiple agent types

### Phase 4.1: Agent Type Extension
- [ ] Test agent_type validation with different values (REQ-CST-006)
- [ ] Update launchAIInTerminal for other agent types if they support hooks
- [ ] Create documentation for adding new agent types
- [ ] Test concurrent sessions from different agent types

### Phase 4.2: Multiple Sessions per Terminal
- [ ] Test multiple Claude sessions in same terminal (REQ-CST-003)
- [ ] Verify current_agent_session_id updates correctly (REQ-CST-004)
- [ ] Implement session history viewing
- [ ] Test session uniqueness constraints

## Milestone 5: Production Readiness
**Goal**: Feature ready for production use
**Demo**: Complete feature with monitoring and documentation

### Phase 5.1: Testing & Validation
- [ ] Complete all unit tests
- [ ] Run integration test suite
- [ ] Perform manual testing scenarios from technical design
- [ ] Load test with multiple concurrent sessions
- [ ] Test migration on copy of production database

### Phase 5.2: Documentation & Deployment
- [ ] Update CLAUDE.md with new feature documentation
- [ ] Create user documentation for session tracking
- [ ] Document API endpoint in API documentation
- [ ] Create troubleshooting guide
- [ ] Deploy to production environment

## Implementation Notes

### Priority Order
1. **Critical Path**: Phases 1.1-1.3, 3.1-3.2 (Core functionality)
2. **High Priority**: Phases 2.1, 5.1 (Real-time updates and testing)
3. **Medium Priority**: Phases 2.2, 4.1-4.2 (UI and multi-agent)
4. **Low Priority**: Phase 5.2 (Documentation)

### Testing Strategy
- Each phase should include its own tests
- Integration tests after each milestone
- Manual testing checklist before production

### Risk Mitigation
- Database rollback script ready before migration
- Feature flag for gradual rollout
- Comprehensive logging for debugging
- Silent failure prevents blocking AI operations

### Success Criteria
- [ ] Claude sessions tracked without user intervention
- [ ] Zero impact on Claude startup performance
- [ ] Real-time visibility of session IDs
- [ ] Support for multiple AI agent types
- [ ] 99%+ session capture rate